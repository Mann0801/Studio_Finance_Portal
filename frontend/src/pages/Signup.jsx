import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendMagicLink } from '../lib/auth'
import { STUDIO_NAME } from '../lib/brand'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Signup() {
  const [method, setMethod] = useState('email') // 'email' | 'phone'
  const [step, setStep] = useState('enter') // 'enter' | 'sent'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendLink(e) {
    e.preventDefault()
    setError('')
    if (method === 'phone') {
      setError('Phone login is coming soon — please continue with email for now.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      await sendMagicLink(email, { createUser: true })
      setStep('sent')
    } catch (err) {
      setError(err.message || 'Could not send the email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>{step === 'sent' ? 'Check your email' : 'Create your account'}</h1>
        <p className="auth-sub">
          {step === 'sent'
            ? 'Tap the sign-in link we just sent you.'
            : 'Sign up with your email — we’ll send you a sign-in link.'}
        </p>
      </div>

      {step === 'enter' ? (
        <form onSubmit={sendLink} className="form">
          <div className="seg">
            <button
              type="button"
              className={`seg-opt ${method === 'email' ? 'active' : ''}`}
              onClick={() => {
                setMethod('email')
                setError('')
              }}
            >
              Email
            </button>
            <button
              type="button"
              className={`seg-opt ${method === 'phone' ? 'active' : ''}`}
              onClick={() => {
                setMethod('phone')
                setError('')
              }}
            >
              Phone
            </button>
          </div>

          {method === 'email' ? (
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                placeholder="you@example.com"
              />
            </label>
          ) : (
            <label>
              Phone number
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                placeholder="10-digit mobile number"
                disabled
              />
              <span className="field-hint">Phone sign-in is coming soon.</span>
            </label>
          )}

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      ) : (
        <div className="stack">
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 6 }}>
              We sent a link to <strong>{email}</strong>.
            </p>
            <p className="muted small">
              Open it on this device to continue. The link expires shortly and can be used once.
            </p>
          </div>
          <button
            className="btn ghost block"
            onClick={() => sendMagicLink(email, { createUser: true }).catch(() => {})}
          >
            Resend link
          </button>
          <button
            className="link-btn"
            style={{ alignSelf: 'center' }}
            onClick={() => {
              setStep('enter')
              setError('')
            }}
          >
            ← Use a different email
          </button>
        </div>
      )}

      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
