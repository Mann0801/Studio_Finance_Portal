import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { phoneToEmail, toTenDigits } from '../lib/auth'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import OtpInput from '../components/OtpInput'
import LegalFooter from '../components/LegalFooter'

// Supabase's minimum is 6 digits (4 isn't possible) — must match the "OTP
// Length" setting in Supabase Dashboard → Authentication → Emails.
const CODE_LENGTH = 6

/** Self-serve password reset, as three separate screens: phone → code
 * (auto-verifies the instant it's fully typed, no button to tap) → new
 * password. Verified directly against Supabase (no link to click, no
 * leaving the app — see EmailBanner for why a student might not have a
 * recovery email on file yet). */
export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('phone') // 'phone' | 'code' | 'password'
  const [phone, setPhone] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [resetAttempt, setResetAttempt] = useState(0)
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmState = !confirm
    ? ''
    : confirm === newPassword && newPassword
      ? 'match'
      : 'mismatch'

  async function requestCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api('/api/password-reset/request', {
        method: 'POST',
        body: { phone: phone.replace(/\D/g, '') },
        auth: false,
      })
      setSentTo(res.message)
      setStep('code')
    } catch (err) {
      setError(err.message || 'Could not send a reset code')
    } finally {
      setBusy(false)
    }
  }

  async function onCodeComplete(code) {
    setError('')
    setBusy(true)
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: phoneToEmail(phone),
        token: code,
        type: 'recovery',
      })
      if (verifyErr) throw new Error('That code is invalid or expired')
      setStep('password')
    } catch (err) {
      setError(err.message || 'Could not verify that code')
      setResetAttempt((n) => n + 1) // clears the boxes for another try
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('At least 8 characters')
      return
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) {
        if (updateErr.code === 'same_password') {
          throw new Error('New password cannot be the same as your old one')
        }
        throw new Error(updateErr.message || 'Could not set your new password')
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not reset your password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src={LOGO_SRC} alt="I'm Possible Fit" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Reset your password</h1>
        <p className="auth-sub">
          {step === 'phone' && "We'll email you a reset code."}
          {step === 'code' && 'Enter the code we emailed you.'}
          {step === 'password' && 'Choose a new password.'}
        </p>
      </div>

      {step === 'phone' && (
        <form key="phone" onSubmit={requestCode} className="form auth-step-in">
          <label>
            Phone number
            <div className="phone-field">
              <span className="phone-cc">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(toTenDigits(e.target.value))}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                required
              />
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <div key="code" className="form auth-step-in">
          <p className="field-ok">{sentTo}</p>
          <OtpInput key={resetAttempt} length={CODE_LENGTH} onComplete={onCodeComplete} disabled={busy} />
          {busy && <p className="muted small" style={{ textAlign: 'center' }}>Verifying…</p>}
          {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
          <button type="button" className="btn ghost block" onClick={() => setStep('phone')} disabled={busy}>
            Use a different phone number
          </button>
        </div>
      )}

      {step === 'password' && (
        <form key="password" onSubmit={resetPassword} className="form auth-step-in">
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={confirmState === 'match' ? 'valid' : ''}
              autoComplete="new-password"
              required
            />
            {confirmState === 'match' && <span className="field-ok">Passwords match ✓</span>}
            {confirmState === 'mismatch' && <span className="field-hint">Passwords don’t match yet</span>}
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}

      <p className="auth-foot" style={{ marginTop: 14 }}>
        <Link to="/login">Back to login</Link>
      </p>

      <LegalFooter />
    </div>
  )
}
