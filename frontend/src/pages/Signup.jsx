import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { signUpWithPassword, setLastEmail } from '../lib/auth'
import { batchById } from '../lib/batches'
import { STUDIO_NAME } from '../lib/brand'
import BatchPicker from '../components/BatchPicker'
import LegalFooter from '../components/LegalFooter'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address'
  if (!form.password) errors.password = 'Set a password'
  else if (form.password.length < 8) errors.password = 'At least 8 characters'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a batch'
  else if (batchById(form.batch)?.hasSlots && !form.batch_slot)
    errors.batch = 'Please choose a timing for Traditional Yoga'
  return errors
}

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    batch: '',
    batch_slot: null,
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      // 1) Create the auth account (logs in immediately — Confirm email is off).
      await signUpWithPassword(form.email, form.password)
      // 2) Create the student profile (idempotent, keyed to the verified user).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
          batch_slot: form.batch_slot,
        },
      })
      // 3) Already signed in — straight to the first payment.
      setLastEmail(form.email.trim().toLowerCase())
      navigate('/first-payment', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create your account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap page">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Create your account</h1>
        <p className="auth-sub">A few details and you’re in.</p>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Full name
          <input value={form.name} onChange={set('name')} className={errors.name ? 'invalid' : ''} autoComplete="name" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Email address
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            className={errors.email ? 'invalid' : ''}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="you@example.com"
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            className={errors.password ? 'invalid' : ''}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        <label>
          Phone
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))}
            maxLength={10}
            className={errors.phone ? 'invalid' : ''}
            placeholder="10-digit mobile number"
            autoComplete="tel"
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <BatchPicker
          batch={form.batch}
          slot={form.batch_slot}
          error={errors.batch}
          onSelect={(batch, slot) => {
            setForm((f) => ({ ...f, batch, batch_slot: slot }))
            if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
          }}
        />

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="consent-note">
          By creating an account you agree to our <Link to="/terms">Terms</Link> and{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </form>

      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>

      <LegalFooter />
    </div>
  )
}
