import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { rupees } from '../lib/batches'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
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

  const paidOn = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="success-wrap page">
      <Confetti />
      <div className="success-check">
        <CheckIcon width={48} height={48} />
      </div>
      <h1>Payment successful</h1>
      <div className="success-amt">{rupees(state.amountPaise)}</div>

      {/* Receipt — the student can screenshot this for their records. */}
      <div className="receipt">
        <div className="receipt-head">
          <img src={LOGO_SRC} alt="" className="receipt-logo" />
          <div>
            <div className="receipt-studio">{STUDIO_NAME}</div>
            <div className="muted small">Fee receipt</div>
          </div>
        </div>
        <div className="receipt-rows">
          {state.studentName && (
            <div className="receipt-row">
              <span className="muted">Student</span>
              <span>{state.studentName}</span>
            </div>
          )}
          {state.batchLabel && (
            <div className="receipt-row">
              <span className="muted">Batch</span>
              <span>
                {state.batchLabel}
                {state.slotLabel ? ` · ${state.slotLabel}` : ''}
              </span>
            </div>
          )}
          <div className="receipt-row">
            <span className="muted">Month</span>
            <span>{periodLabel(state.period)}</span>
          </div>
          <div className="receipt-row">
            <span className="muted">Amount</span>
            <span style={{ fontWeight: 700 }}>{rupees(state.amountPaise)}</span>
          </div>
          <div className="receipt-row">
            <span className="muted">Paid on</span>
            <span>{paidOn}</span>
          </div>
          <div className="receipt-row">
            <span className="muted">Method</span>
            <span>Online</span>
          </div>
          {state.paymentId && (
            <div className="receipt-row">
              <span className="muted">Reference</span>
              <span className="receipt-ref">{state.paymentId}</span>
            </div>
          )}
          <div className="receipt-row">
            <span className="muted">Status</span>
            <span className="receipt-paid">Paid</span>
          </div>
        </div>
      </div>

      <button
        className="btn primary lg block"
        style={{ marginTop: 24, maxWidth: 320 }}
        onClick={() => navigate('/', { replace: true })}
      >
        Go to dashboard
      </button>
    </div>
  )
}
