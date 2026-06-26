import { Link } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { STUDIO_NAME } from '../../lib/brand'
import StatusBadge from '../../components/StatusBadge'
import { CheckIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Home() {
  const { data, loading, error } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()

  if (loading) {
    return (
      <>
        <div className="topbar">
          <div className="greeting">
            <Skeleton height={14} width={90} />
            <Skeleton height={26} width={160} style={{ marginTop: 6 }} />
          </div>
        </div>
        <CardSkeleton lines={1} />
      </>
    )
  }
  if (error) return <p className="error" style={{ marginTop: 24 }}>{error}</p>
  if (!data) return null

  const { student, current, history } = data
  const paid = current.status === 'paid'
  const recent = history.slice(0, 3)

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <div className="hello brand-tag">{STUDIO_NAME}</div>
          <h1>Hi, {student.name.split(' ')[0]}</h1>
          <div className="hello" style={{ marginTop: 4 }}>{student.batch_label} batch</div>
        </div>
        <div className="avatar">{student.name.charAt(0).toUpperCase()}</div>
      </div>

      {/* Hero payment card */}
      {paid ? (
        <div className="pay-card paid-card">
          <div className="paid-badge"><CheckIcon width={26} height={26} /></div>
          <div className="paid-title">You're all paid up</div>
          <div className="period">{periodLabel(current.period)} · {rupees(current.amount_paise)} paid</div>
        </div>
      ) : (
        <div className="pay-card">
          <div className="between">
            <span className="card-title">Amount due</span>
            <StatusBadge status={current.status} />
          </div>
          <div className="amount">{rupees(current.amount_paise)}</div>
          <div className="period">
            {periodLabel(current.period)}
            {current.is_prorata ? ' · pro-rated first month' : ''}
          </div>
          {current.amount_paise > 0 && (
            <button
              className="btn primary lg block"
              style={{ marginTop: 18 }}
              onClick={() => pay()}
              disabled={paying}
            >
              {paying ? 'Processing…' : `Pay ${rupees(current.amount_paise)} now`}
            </button>
          )}
          {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
        </div>
      )}

      {/* Recent payments */}
      <div className="section-h" style={{ marginTop: 22 }}>
        <h2>Recent payments</h2>
        <Link to="/payments" className="small">See all</Link>
      </div>
      {recent.length === 0 ? (
        <div className="card empty">No payments yet.</div>
      ) : (
        <div className="card flush list">
          {recent.map((p) => (
            <div className="list-item" key={p.period}>
              <div>
                <div className="li-main">{periodLabel(p.period)}</div>
                <div className="li-sub">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : 'Pending'}
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
  )
}
