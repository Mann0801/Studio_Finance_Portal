import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { rupees } from '../lib/batches'
import { CheckIcon } from '../components/Icons'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Direct visits with no payment context go home.
  if (!state?.period) return <Navigate to="/" replace />

  return (
    <div className="success-wrap page">
      <div className="success-check">
        <CheckIcon width={48} height={48} />
      </div>
      <h1>Payment successful</h1>
      <div className="success-amt">{rupees(state.amountPaise)}</div>
      <p className="muted">{periodLabel(state.period)} fee</p>
      <p className="muted small" style={{ marginTop: 4 }}>
        {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      {state.paymentId && (
        <p className="muted small" style={{ marginTop: 6 }}>
          Ref: {state.paymentId}
        </p>
      )}
      <button
        className="btn primary lg block"
        style={{ marginTop: 28, maxWidth: 320 }}
        onClick={() => navigate('/', { replace: true })}
      >
        Go to dashboard
      </button>
    </div>
  )
}
