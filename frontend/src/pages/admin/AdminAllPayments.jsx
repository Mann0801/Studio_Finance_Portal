import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { periodLabel } from '../../lib/periods'
import { groupByBatch } from '../../lib/paymentGroups'
import { ArrowLeftIcon, WhatsAppIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'
import BatchBreakdownList from '../../components/BatchBreakdownList'

const TABS = [
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'batch', label: 'By batch' },
]

/** Every payment for one month, in full — reached from Payments → Collected
 * → "Show all". Same Paid/Unpaid/By batch grouping as the main Payments
 * page, just unfiltered lists instead of a capped preview. */
export default function AdminAllPayments() {
  const { period } = useParams()
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [month, setMonth] = useState(null)
  const [tab, setTab] = useState('paid')

  useEffect(() => {
    adminApi(`/api/admin/month/${period}`).then(setMonth).catch(guard)
  }, [period, guard])

  const rows = useMemo(() => month?.rows ?? [], [month])
  const pending = useMemo(
    () => rows.filter((r) => r.status !== 'paid' && r.status !== 'waived'),
    [rows],
  )
  // Every individual payment received this month — already sorted most
  // recent first by the backend.
  const collected = useMemo(() => month?.transactions ?? [], [month])
  const byBatch = useMemo(() => groupByBatch(rows), [rows])

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>All payments</h1>
          <div className="hello" style={{ marginTop: 4 }}>{periodLabel(period)}</div>
        </div>
      </div>

      <div className="seg" style={{ marginTop: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`seg-opt ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'unpaid' && pending.length > 0 ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      {!month ? (
        <div style={{ marginTop: 16 }}>
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <>
          {tab === 'paid' && (
            <div style={{ marginTop: 16 }}>
              {collected.length === 0 ? (
                <div className="card empty">No payments received this month yet.</div>
              ) : (
                <div className="card flush">
                  <div className="data-row head">
                    <span>Name</span>
                    <span>Class</span>
                    <span style={{ textAlign: 'right' }}>Paid</span>
                  </div>
                  {collected.map((p) => (
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
              )}
            </div>
          )}

          {tab === 'unpaid' && (
            <div style={{ marginTop: 16 }}>
              {pending.length === 0 ? (
                <div className="card empty">Everyone's paid for this month 🎉</div>
              ) : (
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
              )}
            </div>
          )}

          {tab === 'batch' && (
            <div style={{ marginTop: 16 }}>
              <BatchBreakdownList byBatch={byBatch} />
            </div>
          )}
        </>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
