import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { ensureProfile } from '../lib/profile'
import { payForMonth } from '../lib/razorpay'
import { rupees } from '../lib/batches'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import { CardSkeleton } from '../components/Skeleton'

/* Shown immediately after signup: the student pays their (pro-rated) first month
   right away. On success -> success screen; if somehow already paid -> dashboard. */
export default function FirstPayment() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await ensureProfile()
        const d = await api('/api/me/dashboard')
        if (!active) return
        if (d.current.status === 'paid' || d.current.amount_paise <= 0) {
          navigate('/', { replace: true })
          return
        }
        setData(d)
      } catch (e) {
        if (!active) return
        if (/complete signup|profile not found/i.test(e.message)) {
          navigate('/profile-setup', { replace: true })
        } else {
          setError(e.message)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [navigate])

  async function onPay() {
    setError('')
    setPaying(true)
    try {
      const result = await payForMonth()
      navigate('/payment-success', { state: result, replace: true })
    } catch (e) {
      if (e.message !== 'Payment cancelled') setError(e.message)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="auth-wrap page">
      <div className="auth-brand">
        <img src={LOGO_SRC} alt="I'm Possible Fit" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>You're in! 🎉</h1>
        <p className="auth-sub">Complete your first payment to get started.</p>
      </div>

      {!data && !error && <CardSkeleton lines={1} />}
      {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}

      {data && (
        <>
          <div className="pay-card">
            <span className="card-title">{data.student.batch_label} · first month</span>
            <div className="amount">{rupees(data.current.amount_paise)}</div>
            <div className="period">
              {data.current.is_prorata
                ? 'Pro-rated from today to month-end'
                : 'Monthly fee'}
            </div>
          </div>

          <div className="stack" style={{ marginTop: 18 }}>
            <button className="btn primary lg block" onClick={onPay} disabled={paying}>
              {paying ? 'Processing…' : `Pay ${rupees(data.current.amount_paise)} now`}
            </button>
            <button className="btn ghost block" onClick={() => navigate('/', { replace: true })}>
              I'll pay later
            </button>
          </div>
          <p className="muted small" style={{ textAlign: 'center', marginTop: 14 }}>
            From next month, fees are due on the 1st.
          </p>
        </>
      )}
    </div>
  )
}
