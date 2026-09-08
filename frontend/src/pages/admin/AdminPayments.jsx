import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { SearchIcon, DownloadIcon, WhatsAppIcon } from '../../components/Icons'
import { Skeleton, ListSkeleton } from '../../components/Skeleton'
import { toCsv, downloadCsv } from '../../lib/csv'
import { currentPeriod, shiftPeriod, periodLabel } from '../../lib/periods'
import { groupByBatch } from '../../lib/paymentGroups'
import BatchBreakdownList from '../../components/BatchBreakdownList'

function pct(n) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

function dateLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
  return `${date}, ${time}`
}

const TABS = [
  { id: 'collected', label: 'Collected' },
  { id: 'pending', label: 'Pending' },
  { id: 'batch', label: 'By batch' },
]

// The Collected tab defaults to a short "recent" preview — the full list
// (plus Unpaid, grouped above it) lives on the "All payments" page.
const RECENT_LIMIT = 10

export default function AdminPayments() {
  const navigate = useNavigate()
  const { stats, guard } = useAdmin()
  const CUR = currentPeriod()
  const [period, setPeriod] = useState(CUR)
  const [month, setMonth] = useState(null)
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get('tab')
    return TABS.some((t) => t.id === requested) ? requested : 'collected'
  })

  // Reload the whole roster whenever the selected month changes.
  useEffect(() => {
    adminApi(`/api/admin/month/${period}`).then(setMonth).catch(guard)
  }, [period, guard])

  // While the fetch is in flight `month` still holds the previous month's data,
  // so treat a period mismatch as loading rather than clearing state in the effect.
  const loading = !month || month.period !== period
  const rows = useMemo(() => (loading ? [] : month.rows), [loading, month])

  // Collected: every individual payment received this month (a partial and
  // its later remainder each their own row), most recent first — already
  // sorted that way by the backend.
  const collected = useMemo(() => (loading ? [] : month.transactions), [loading, month])
  // Pending: not fully paid — a partial payer shows in both lists (paid some,
  // owes some). A waived month is settled, not pending.
  const pending = useMemo(() => rows.filter((r) => r.status !== 'paid' && r.status !== 'waived'), [rows])

  // While searching, show every match — the recent-only cap only applies to
  // the default unfiltered preview.
  const visibleCollected = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q) return collected.filter((p) => p.name.toLowerCase().includes(q))
    return collected.slice(0, RECENT_LIMIT)
  }, [collected, search])

  const pendingTotal = useMemo(
    () => pending.reduce((sum, s) => sum + Math.max(s.due_paise - s.paid_paise, 0), 0),
    [pending],
  )
  const pendingCount = pending.length
  const collectionRate = loading || month.expected_paise <= 0
    ? 0
    : Math.min(Math.round((month.collected_paise / month.expected_paise) * 100), 100)

  // By batch: collapse the roster into per-class collection, with slot breakdown.
  const byBatch = useMemo(() => groupByBatch(rows), [rows])

  const exportCsv = () => {
    if (collected.length === 0) return
    const headers = ['Name', 'Batch', 'Timing', 'Month', 'Amount (INR)', 'Method', 'Paid on']
    const csvRows = collected.map((p) => [
      p.name,
      p.batch_label,
      p.slot_label || '',
      periodLabel(period),
      (p.amount_paise / 100).toFixed(2),
      p.method || '',
      p.paid_at ? dateLabel(p.paid_at) : '',
    ])
    downloadCsv(`payments-${period}.csv`, toCsv(headers, csvRows))
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Payments</h1>
        </div>
      </div>

      {/* Month navigator — steps through past months; can't go past the current one */}
      <div className="month-nav">
        <button type="button" aria-label="Previous month" onClick={() => setPeriod(shiftPeriod(period, -1))}>
          ‹
        </button>
        <div className="month-nav-label">
          {periodLabel(period)}
          {period === CUR ? <span className="today-tag">This month</span> : null}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setPeriod(shiftPeriod(period, 1))}
          disabled={period >= CUR}
        >
          ›
        </button>
      </div>

      {/* Revenue hero — collected in the selected month + what's still pending */}
      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={34} width="55%" style={{ marginTop: 10 }} />
          <Skeleton height={13} width="70%" style={{ marginTop: 10 }} />
        </div>
      ) : (
        <div className="card pay-hero" style={{ marginTop: 12 }}>
          <div className="muted small">{month.is_current ? 'Collected this month' : `Collected in ${periodLabel(period)}`}</div>
          <div className="amount" style={{ fontSize: 34, marginTop: 2 }}>
            {rupees(month.collected_paise)}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>of {rupees(month.expected_paise)} expected</div>

          <div className="ct-bar" style={{ marginTop: 12 }}>
            <span style={{ width: `${collectionRate}%` }} />
          </div>
          <div className="ct-stats">
            <span className="ct-dot paid">{month.paid_count} paid</span>
            <span className="ct-dot unpaid">{pendingCount} pending</span>
          </div>

          {month.is_current && stats && (
            <div className="pay-hero-sub">
              <span
                className="pay-chip"
                style={{ color: stats.revenue_change_pct >= 0 ? 'var(--paid)' : 'var(--unpaid)' }}
              >
                {pct(stats.revenue_change_pct)} vs last month
              </span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="pay-hero-pending">
              <span className="dot unpaid" />
              <strong>{rupees(pendingTotal)}</strong>&nbsp;still pending
            </div>
          )}
        </div>
      )}

      {/* Segmented switch */}
      <div className="seg" style={{ marginTop: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`seg-opt ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* ── Collected: searchable list of who paid this month ── */}
      {tab === 'collected' && (
        <>
          <div className="section-h" style={{ marginTop: 16, marginBottom: 8 }}>
            <h2>Collected · {periodLabel(period)}</h2>
            {collected.length > 0 && (
              <button type="button" className="link-btn" onClick={exportCsv}>
                <DownloadIcon width={15} height={15} /> Export CSV
              </button>
            )}
          </div>
          {!search && collected.length > RECENT_LIMIT && (
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              Showing the {RECENT_LIMIT} most recent.
            </p>
          )}
          <div className="search">
            <SearchIcon width={18} height={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              autoCapitalize="none"
            />
          </div>

          {loading ? (
            <ListSkeleton rows={5} />
          ) : visibleCollected.length === 0 ? (
            <div className="card empty">
              {collected.length > 0 ? 'No payments match.' : 'No payments received this month yet.'}
            </div>
          ) : (
            <div className="card flush" style={{ marginTop: 12 }}>
              <div className="data-row head">
                <span>Name</span>
                <span>Class</span>
                <span style={{ textAlign: 'right' }}>Paid</span>
              </div>
              <div className="scroll-list scroll-tall">
                {visibleCollected.map((p) => (
                  <div
                    className="data-row"
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/students/${p.student_id}`)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${p.student_id}`)}
                  >
                    <span className="data-name">{p.name}</span>
                    <span className="data-sub data-sub-2line">
                      <span>{p.batch_label}</span>
                      {p.slot_label && <span className="data-sub-timing">{p.slot_label}</span>}
                    </span>
                    <div className="data-end">
                      <div style={{ color: p.is_partial ? 'var(--warn)' : 'var(--paid)', fontWeight: 700, fontSize: 16 }}>
                        {rupees(p.amount_paise)}
                      </div>
                      {p.is_partial && (
                        <div style={{ color: 'var(--warn)', fontWeight: 700 }}>partial</div>
                      )}
                      {p.method && p.method !== 'Online' && p.method !== 'Cash' && (
                        <div className="muted">{p.method}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!search && collected.length > RECENT_LIMIT && (
            <button
              type="button"
              className="btn ghost block show-all-cta"
              style={{ marginTop: 10 }}
              onClick={() => navigate(`/admin/payments/${period}/all`)}
            >
              Show all payment details
            </button>
          )}
        </>
      )}

      {/* ── Pending: who still owes this month + WhatsApp reminders ── */}
      {tab === 'pending' && (
        <>
          <div className="section-h" style={{ marginTop: 16, marginBottom: 4 }}>
            <h2>Awaiting payment · {periodLabel(period)}</h2>
            {pendingCount > 0 && <span className="muted small">{rupees(pendingTotal)} total</span>}
          </div>
          {loading ? (
            <ListSkeleton rows={3} />
          ) : pending.length === 0 ? (
            <div className="card empty">Everyone's paid for this month 🎉</div>
          ) : (
            <>
              <p className="muted small" style={{ margin: '0 0 8px' }}>
                Tap Remind to open WhatsApp with a prefilled message.
              </p>
              <div className="card flush">
                <div className="data-row head">
                  <span>Name</span>
                  <span>Class</span>
                  <span style={{ textAlign: 'right' }}>Due</span>
                </div>
                {pending.map((s) => (
                  <div
                    className="data-row"
                    key={`${s.id}-${s.batch}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/students/${s.id}`)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
                  >
                    <span className="data-name">{s.name}</span>
                    <span className="data-sub data-sub-2line">
                      <span>{s.batch_label}</span>
                      {s.slot_label && <span className="data-sub-timing">{s.slot_label}</span>}
                    </span>
                    <div className="data-end">
                      <div style={{ color: 'var(--unpaid)', fontWeight: 700, fontSize: 16 }}>
                        {rupees(Math.max(s.due_paise - s.paid_paise, 0))}
                      </div>
                      {s.status === 'partial' && (
                        <div style={{ color: 'var(--warn)', fontWeight: 700 }}>part-paid</div>
                      )}
                      {s.whatsapp_url && (
                        <a
                          className="wa-btn"
                          href={s.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginTop: 4, minHeight: 26, padding: '0 10px', fontSize: 12 }}
                        >
                          <WhatsAppIcon width={12} height={12} /> Remind
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── By batch: collection breakdown for the selected month ── */}
      {tab === 'batch' && (
        <div style={{ marginTop: 16 }}>
          {loading ? <ListSkeleton rows={4} /> : <BatchBreakdownList byBatch={byBatch} />}
        </div>
      )}

      <div style={{ height: 28 }} />
    </>
  )
}
