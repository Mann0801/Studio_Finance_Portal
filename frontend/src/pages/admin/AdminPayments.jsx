import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { slotById, rupees } from '../../lib/batches'
import { SearchIcon, DownloadIcon, WhatsAppIcon } from '../../components/Icons'
import { Skeleton, ListSkeleton } from '../../components/Skeleton'
import { toCsv, downloadCsv } from '../../lib/csv'

function pct(n) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

function dateLabel(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function AdminPayments() {
  const { stats, guard } = useAdmin()
  const [history, setHistory] = useState(null)
  const [unpaid, setUnpaid] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminApi('/api/admin/payments').then(setHistory).catch(guard)
    adminApi('/api/admin/unpaid').then(setUnpaid).catch(guard)
  }, [guard])

  const visible = useMemo(() => {
    if (!history) return null
    const q = search.trim().toLowerCase()
    return q ? history.filter((p) => p.name.toLowerCase().includes(q)) : history
  }, [history, search])

  const exportCsv = () => {
    if (!history || history.length === 0) return
    const headers = ['Name', 'Batch', 'Timing', 'Month', 'Amount (INR)', 'Method', 'Paid on']
    const rows = history.map((p) => [
      p.name,
      p.batch_label,
      p.slot_label || '',
      periodLabel(p.period),
      (p.amount_paise / 100).toFixed(2),
      p.method,
      p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : '',
    ])
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`payments-${stamp}.csv`, toCsv(headers, rows))
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Payments</h1>
        </div>
      </div>

      {/* Revenue summary */}
      {!stats ? (
        <div className="stat-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="stat" key={i}>
              <Skeleton height={24} width="60%" />
              <Skeleton height={13} width="70%" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-grid stat-grid-3">
          <div className="stat">
            <div className="num">{rupees(stats.revenue_paise)}</div>
            <div className="label">This month</div>
          </div>
          <div className="stat">
            <div className="num">{rupees(stats.last_month_revenue_paise)}</div>
            <div className="label">Last month</div>
          </div>
          <div className="stat">
            <div className={`num ${stats.revenue_change_pct >= 0 ? '' : ''}`}
                 style={{ color: stats.revenue_change_pct >= 0 ? 'var(--paid)' : 'var(--unpaid)' }}>
              {pct(stats.revenue_change_pct)}
            </div>
            <div className="label">vs last month</div>
          </div>
        </div>
      )}

      {/* Send reminders to unpaid students */}
      <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
        <h2>Send reminders</h2>
        {unpaid && unpaid.length > 0 && (
          <span className="muted small">{unpaid.length} unpaid</span>
        )}
      </div>
      {unpaid === null ? (
        <ListSkeleton rows={2} />
      ) : unpaid.length === 0 ? (
        <div className="card empty">Everyone's paid this month 🎉</div>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 8px' }}>
            Tap to open WhatsApp with a prefilled reminder for each student.
          </p>
          <div className="card flush list">
            {unpaid.map((s) => (
              <div className="list-item pay-row" key={s.id}>
                <div className="li-main">
                  <div className="feed-name">{s.name}</div>
                  <div className="muted small">
                    {rupees(s.amount_paise)} due{s.slot_label ? ` · ${s.slot_label}` : ''}
                  </div>
                </div>
                {s.whatsapp_url && (
                  <a
                    className="wa-btn"
                    href={s.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon width={16} height={16} /> Remind
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Per-batch revenue breakdown */}
      <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
        <h2>By batch</h2>
      </div>
      {!stats ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {stats.per_batch.map((b) => (
            <div className="card" key={b.batch}>
              <div className="between">
                <strong>{b.batch_label}</strong>
                <span className="muted small">{b.paid_count}/{b.total_students} paid · {b.collection_rate}%</span>
              </div>
              <div className="between" style={{ marginTop: 4 }}>
                <span className="muted small">{rupees(b.revenue_paise)} of {rupees(b.expected_paise)}</span>
              </div>
              <div className="bar"><span style={{ width: `${Math.min(b.collection_rate, 100)}%` }} /></div>

              {b.slots?.length > 0 && (
                <div className="slot-breakdown">
                  {b.slots.map((s) => (
                    <div key={s.slot} className="between slot-row">
                      <span className="muted small">{slotById(s.slot)?.label || s.slot} · {s.slot_label}</span>
                      <span className="muted small">
                        {rupees(s.revenue_paise)} / {rupees(s.expected_paise)} · {s.paid_count}/{s.total_students}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment history */}
      <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
        <h2>Payment history</h2>
        {history && history.length > 0 && (
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

      {visible === null ? (
        <ListSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <div className="card empty">
          {history && history.length > 0 ? 'No payments match.' : 'No payments received yet.'}
        </div>
      ) : (
        <div className="card flush list" style={{ marginTop: 12 }}>
          {visible.map((p) => (
            <div className="list-item pay-row" key={p.id}>
              <div className="li-main">
                <div className="feed-name">{p.name}</div>
                <div className="muted small">
                  {p.batch_label}{p.slot_label ? ` · ${p.slot_label}` : ''} · {p.method}
                </div>
              </div>
              <div className="feed-right">
                <span style={{ color: 'var(--paid)', fontWeight: 700 }}>{rupees(p.amount_paise)}</span>
                <span className="muted small">{dateLabel(p.paid_at) || periodLabel(p.period)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 28 }} />
    </>
  )
}
