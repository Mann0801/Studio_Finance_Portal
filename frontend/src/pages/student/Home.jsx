import { Link } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { LOGO_SRC } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
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

  const { student, current, history, outstanding = [] } = data
  const paid = current.status === 'paid'
  const isEnquiry = student.fee_type === 'enquiry'
  const isDeleted = student.batch_deleted
  const isContact = isEnquiry || isDeleted
  const outstandingPeriods = new Set(outstanding.map((p) => p.period))
  const recent = history.filter((p) => !outstandingPeriods.has(p.period)).slice(0, 3)

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <img src={LOGO_SRC} alt="I'm Possible Fit" className="topbar-logo" />
          <h1>Hi, {student.name.split(' ')[0]}</h1>
          <div className="hello" style={{ marginTop: 4 }}>
            {isDeleted ? 'Class removed' : `${student.batch_label} class`}
          </div>
        </div>
        <div className="avatar">{student.name.charAt(0).toUpperCase()}</div>
      </div>

      {/* Hero card */}
      {isContact ? (
        <div className="pay-card">
          <div className="card-title">{isDeleted ? 'Class no longer available' : 'Contact the studio'}</div>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {isDeleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class is arranged directly with the studio — reach out to sort out your membership and payment.'}
          </p>
          <a className="btn primary lg block" style={{ marginTop: 16 }} href={`tel:${BUSINESS.phones[0]}`}>
            Call {BUSINESS.phones[0]}
          </a>
          {BUSINESS.phones[1] && (
            <a className="btn ghost block" style={{ marginTop: 8 }} href={`tel:${BUSINESS.phones[1]}`}>
              Call {BUSINESS.phones[1]}
            </a>
          )}
        </div>
      ) : paid ? (
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

      {outstanding.length > 0 && (
        <Link to="/payments" className="due-alert">
          <span>
            {outstanding.length === 1
              ? '1 earlier month is unpaid'
              : `${outstanding.length} earlier months are unpaid`}
          </span>
          <span className="due-alert-cta">Pay now →</span>
        </Link>
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
