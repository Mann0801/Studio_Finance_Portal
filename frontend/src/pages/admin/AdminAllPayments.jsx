import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { formatPhoneDisplay } from '../../lib/auth'
import { rupees } from '../../lib/batches'
import { periodLabel } from '../../lib/periods'
import { groupByBatch } from '../../lib/paymentGroups'
import { ArrowLeftIcon, WhatsAppIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'
import BatchBreakdownList from '../../components/BatchBreakdownList'

function dateOnly(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

function timeOnly(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

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
    () => rows.filter((r) => r.status !== 'paid' && r.status !== 'waived' && r.status !== 'package' && r.status !== 'paused'),
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
                  {collected.map((p, i) => (
                    <div
                      className="record-row"
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/students/${p.student_id}`)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${p.student_id}`)}
                    >
                      <div className="record-num">{i + 1}</div>
                      <div className="record-body">
                        <div className="record-name">{p.name}</div>
                        <div className="record-fields">
                          <span><b>Phone</b> {formatPhoneDisplay(p.phone)}</span>
                          <span><b>Class</b> {p.batch_label}{p.slot_label ? ` · ${p.slot_label}` : ''}</span>
                          <span className="amount-status" style={{ color: p.is_partial ? 'var(--warn)' : 'var(--paid)' }}>
                            <b>Paid</b> {rupees(p.amount_paise)}{p.is_partial ? ' (partial)' : ''}
                          </span>
                          {p.paid_at && (
                            <>
                              <span><b>Paid on</b> {dateOnly(p.paid_at)}</span>
                              <span><b>Time</b> {timeOnly(p.paid_at)}</span>
                            </>
                          )}
                          <span><b>Method</b> {p.method}</span>
                        </div>
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
                  {pending.map((s, i) => (
                    <div
                      className="record-row"
                      key={`${s.id}-${s.batch}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/students/${s.id}`)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
                    >
                      <div className="record-num">{i + 1}</div>
                      <div className="record-body">
                        <div className="record-name">{s.name}</div>
                        <div className="record-fields">
                          <span><b>Phone</b> {formatPhoneDisplay(s.phone)}</span>
                          <span><b>Class</b> {s.batch_label}{s.slot_label ? ` · ${s.slot_label}` : ''}</span>
                          <span className="amount-status unpaid">
                            <b>Due</b> {rupees(Math.max(s.due_paise - s.paid_paise, 0))}{s.status === 'partial' ? ' (part-paid)' : ''}
                          </span>
                        </div>
                      </div>
                      {s.whatsapp_url && (
                        <a
                          className="wa-btn"
                          href={s.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WhatsAppIcon width={12} height={12} /> Remind
                        </a>
                      )}
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
