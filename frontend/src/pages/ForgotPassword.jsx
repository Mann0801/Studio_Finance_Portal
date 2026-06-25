import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendResetEmail } from '../lib/auth'
import { STUDIO_NAME } from '../lib/brand'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [step, setStep] = useState('enter') // 'enter' | 'sent'
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendLink(e) {
    e.preventDefault()
    setError('')
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      await sendResetEmail(email)
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
        <h1>{step === 'sent' ? 'Check your email' : 'Reset password'}</h1>
        <p className="auth-sub">
          {step === 'sent'
            ? 'Tap the link we sent to set a new password.'
            : 'We’ll email you a link to reset your password.'}
        </p>
      </div>

      {step === 'enter' ? (
        <form onSubmit={sendLink} className="form">
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
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 6 }}>
            If <strong>{email}</strong> has an account, a reset link is on its way.
          </p>
          <p className="muted small">Open it on this device to set a new password.</p>
        </div>
      )}

      <p className="auth-foot">
        Remembered it? <Link to="/login">Back to login</Link>
      </p>
    </div>
  )
}
