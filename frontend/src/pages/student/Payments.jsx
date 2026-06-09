import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import { CardSkeleton, ListSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Payments() {
  const { data, loading, error } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()

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

      {data && (
        <>
          <div className="pay-card">
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
          {data.history.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="card flush list">
              {data.history.map((p) => (
                <div className="list-item" key={p.period}>
                  <div>
                    <div className="li-main">{periodLabel(p.period)}</div>
                    <div className="li-sub">
                      {p.is_prorata ? 'Pro-rated · ' : ''}
                      {p.paid_at ? `Paid ${new Date(p.paid_at).toLocaleDateString('en-IN')}` : 'Pending'}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="li-amt">{rupees(p.amount_paise)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
