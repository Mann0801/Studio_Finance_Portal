import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { rupees } from '../lib/batches'
import { CheckIcon } from '../components/Icons'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const CONFETTI_COLORS = ['#3b82f6', '#60a5fa', '#22c55e', '#f5b740', '#a78bfa']

// Generated once at module load (outside render) so it stays stable and pure.
const CONFETTI_PIECES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 0.6,
  duration: 1.8 + Math.random() * 1.4,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}))

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {CONFETTI_PIECES.map((p) => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // Direct visits with no payment context go home.
  if (!state?.period) return <Navigate to="/" replace />

  return (
    <div className="success-wrap page">
      <Confetti />
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
