import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import DueCard from '../../components/DueCard'
import { DownloadIcon } from '../../components/Icons'
import { CardSkeleton, ListSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Payments() {
  const { data, loading, error } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()
  const navigate = useNavigate()

  // Months surfaced above as payable dues shouldn't also appear as "Pending"
  // rows in History (they'd be the same month listed twice).
  const outstandingPeriods = new Set((data?.outstanding ?? []).map((p) => p.period))
  const historyRows = (data?.history ?? []).filter((p) => !outstandingPeriods.has(p.period))
  // Oldest overdue month first (top priority); `outstanding` is newest→oldest.
  const overdue = [...(data?.outstanding ?? [])].reverse()

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Payments</h1>
        </div>
      </div>

      {loading && (
        <>
          <CardSkeleton lines={1} />
          <div style={{ height: 20 }} />
          <ListSkeleton rows={3} />
        </>
      )}
      {error && <p className="error">{error}</p>}

      {data && (data.student.fee_type === 'enquiry' || data.student.batch_deleted) ? (
        <div className="card">
          <span className="card-title">
            {data.student.batch_deleted ? 'Class no longer available' : 'Arranged with the studio'}
          </span>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {data.student.batch_deleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class has no online payment. Contact the studio to arrange your membership.'}
          </p>
        </div>
      ) : data ? (
        <>
          {/* Overdue earlier months first (top priority), then the current month —
              each as a full pay card with its own big Pay button. */}
          {overdue.map((m, i) => (
            <DueCard
              key={m.period}
              month={m}
              paying={paying}
              onPay={pay}
              style={i > 0 ? { marginTop: 12 } : undefined}
            />
          ))}

          <div className="pay-card" style={overdue.length ? { marginTop: 12 } : undefined}>
            <div className="between">
              <span className="card-title">
                {data.current.status === 'paid' ? 'Paid this month' : 'Due this month'}
              </span>
              <StatusBadge status={data.current.status} />
            </div>
            <div className="amount">{rupees(data.current.amount_paise)}</div>
            <div className="period">
              {periodLabel(data.current.period)}
              {data.current.is_prorata ? ' · pro-rated' : ''}
            </div>
            {data.current.status !== 'paid' && data.current.amount_paise > 0 && (
              <button
                className="btn primary lg block"
                style={{ marginTop: 18 }}
                onClick={() => pay()}
                disabled={paying}
              >
                {paying ? 'Processing…' : `Pay ${rupees(data.current.amount_paise)} now`}
              </button>
            )}
            {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
          </div>

          <div className="section-h" style={{ marginTop: 22 }}>
            <h2>History</h2>
          </div>
          {historyRows.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="card flush list">
              {historyRows.map((p) => (
                <div className="list-item" key={p.period}>
                  <div>
                    <div className="li-main">{periodLabel(p.period)}</div>
                    <div className="li-sub">
                      {p.is_prorata ? 'Pro-rated · ' : ''}
                      {p.paid_at ? `Paid ${new Date(p.paid_at).toLocaleDateString('en-IN')}` : 'Pending'}
                    </div>
                  </div>
                  <div className="s-right" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <span className="li-amt">{rupees(p.amount_paise)}</span>
                    {p.status === 'paid' ? (
                      <button
                        type="button"
                        className="link-btn receipt-link"
                        onClick={() => navigate(`/receipt/${p.period}`)}
                      >
                        <DownloadIcon width={14} height={14} /> Receipt
                      </button>
                    ) : (
                      <StatusBadge status={p.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
