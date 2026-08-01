import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { SearchIcon, DownloadIcon, WhatsAppIcon, CashIcon } from '../../components/Icons'
import { Skeleton, ListSkeleton } from '../../components/Skeleton'
import { toCsv, downloadCsv } from '../../lib/csv'
import { currentPeriod, shiftPeriod, periodLabel } from '../../lib/periods'

function pct(n) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

function dateLabel(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

const TABS = [
  { id: 'collected', label: 'Collected' },
  { id: 'pending', label: 'Pending' },
  { id: 'batch', label: 'By batch' },
]

export default function AdminPayments() {
  const { stats, guard } = useAdmin()
  const CUR = currentPeriod()
  const [period, setPeriod] = useState(CUR)
  const [month, setMonth] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('collected')

  // Reload the whole roster whenever the selected month changes.
  useEffect(() => {
    adminApi(`/api/admin/month/${period}`).then(setMonth).catch(guard)
  }, [period, guard])

  // While the fetch is in flight `month` still holds the previous month's data,
  // so treat a period mismatch as loading rather than clearing state in the effect.
  const loading = !month || month.period !== period
  const rows = useMemo(() => (loading ? [] : month.rows), [loading, month])

  // Collected: anyone with money in this month (full or partial cash).
  const collected = useMemo(() => rows.filter((r) => r.paid_paise > 0), [rows])
  // Pending: not fully paid — a partial payer shows in both lists (paid some, owes some).
  const pending = useMemo(() => rows.filter((r) => r.status !== 'paid'), [rows])

  const visibleCollected = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? collected.filter((p) => p.name.toLowerCase().includes(q)) : collected
  }, [collected, search])

  const pendingTotal = useMemo(
    () => pending.reduce((sum, s) => sum + Math.max(s.due_paise - s.paid_paise, 0), 0),
    [pending],
  )
  const pendingCount = pending.length

  // By batch: collapse the roster into per-class collection, with slot breakdown.
  const byBatch = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      let g = map.get(r.batch)
      if (!g) {
        g = { batch: r.batch, batch_label: r.batch_label, total: 0, paid: 0, collected: 0, expected: 0, slots: new Map() }
        map.set(r.batch, g)
      }
      g.total += 1
      if (r.status === 'paid') g.paid += 1
      g.collected += r.paid_paise
      g.expected += r.due_paise
      if (r.slot_label) {
        let sg = g.slots.get(r.slot_label)
        if (!sg) { sg = { label: r.slot_label, total: 0, paid: 0, collected: 0, expected: 0 }; g.slots.set(r.slot_label, sg) }
        sg.total += 1
        if (r.status === 'paid') sg.paid += 1
        sg.collected += r.paid_paise
        sg.expected += r.due_paise
      }
    }
    const rate = (c, e) => (e > 0 ? Math.round((c / e) * 1000) / 10 : 0)
    return [...map.values()].map((g) => ({
      ...g,
      rate: rate(g.collected, g.expected),
      slots: [...g.slots.values()].map((s) => ({ ...s })),
    }))
  }, [rows])

  const exportCsv = () => {
    if (collected.length === 0) return
    const headers = ['Name', 'Batch', 'Timing', 'Month', 'Amount (INR)', 'Method', 'Paid on']
    const csvRows = collected.map((p) => [
      p.name,
      p.batch_label,
      p.slot_label || '',
      periodLabel(period),
      (p.paid_paise / 100).toFixed(2),
      p.method || '',
      p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : '',
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
          <div className="pay-hero-sub">
            {month.is_current && stats && (
              <span
                className="pay-chip"
                style={{ color: stats.revenue_change_pct >= 0 ? 'var(--paid)' : 'var(--unpaid)' }}
              >
                {pct(stats.revenue_change_pct)} vs last month
              </span>
            )}
            <span className="pay-chip">of {rupees(month.expected_paise)} expected</span>
            <span className="pay-chip">{month.paid_count} paid</span>
          </div>
          {pendingCount > 0 && (
            <div className="pay-hero-pending">
              <span className="dot unpaid" />
              <strong>{rupees(pendingTotal)}</strong>&nbsp;pending from {pendingCount} student
              {pendingCount === 1 ? '' : 's'}
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
              <div className="list scroll-list scroll-tall">
                {visibleCollected.map((p) => (
                  <div className="list-item pay-row" key={p.id}>
                    <div className="li-main">
                      <div className="feed-name">{p.name}</div>
                      <div className="muted small">
                        {p.batch_label}{p.slot_label ? ` · ${p.slot_label}` : ''} ·{' '}
                        {p.method === 'Cash' && <CashIcon width={12} height={12} className="cash-ico" />}
                        {p.method}{p.status === 'partial' ? ' · partial' : ''}
                      </div>
                    </div>
                    <div className="feed-right">
                      <span style={{ color: p.status === 'partial' ? 'var(--warn)' : 'var(--paid)', fontWeight: 700 }}>
                        {rupees(p.paid_paise)}
                      </span>
                      <span className="muted small">{dateLabel(p.paid_at) || periodLabel(period)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              <div className="card flush list">
                {pending.map((s) => (
                  <div className="list-item pay-row" key={s.id}>
                    <div className="li-main">
                      <div className="feed-name">{s.name}</div>
                      <div className="muted small">
                        {rupees(Math.max(s.due_paise - s.paid_paise, 0))} due · {s.batch_label}
                        {s.slot_label ? ` · ${s.slot_label}` : ''}
                        {s.status === 'partial' ? ' · part-paid' : ''}
                      </div>
                    </div>
                    {s.whatsapp_url && (
                      <a className="wa-btn" href={s.whatsapp_url} target="_blank" rel="noreferrer">
                        <WhatsAppIcon width={16} height={16} /> Remind
                      </a>
                    )}
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
          {loading ? (
            <ListSkeleton rows={4} />
          ) : byBatch.length === 0 ? (
            <div className="card empty">No students due this month.</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {byBatch.map((b) => (
                <div className="card" key={b.batch}>
                  <div className="between">
                    <strong>{b.batch_label}</strong>
                    <span className="muted small">{b.paid}/{b.total} paid · {b.rate}%</span>
                  </div>
                  <div className="between" style={{ marginTop: 4 }}>
                    <span className="muted small">{rupees(b.collected)} of {rupees(b.expected)}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${Math.min(b.rate, 100)}%` }} /></div>

                  {b.slots.length > 0 && (
                    <div className="slot-breakdown">
                      {b.slots.map((s) => (
                        <div key={s.label} className="between slot-row">
                          <span className="muted small">{s.label}</span>
                          <span className="muted small">
                            {rupees(s.collected)} / {rupees(s.expected)} · {s.paid}/{s.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 28 }} />
    </>
  )
}
