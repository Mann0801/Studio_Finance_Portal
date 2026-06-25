import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BATCHES, rupees } from '../lib/batches'
import { ensureProfile, savePendingProfile } from '../lib/profile'
import { CheckIcon } from '../components/Icons'
import { STUDIO_NAME } from '../lib/brand'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (!form.email.trim()) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address'

  const digits = form.phone.replace(/\D/g, '')
  if (!form.phone.trim()) errors.phone = 'Phone number is required'
  else if (digits.length !== 10) errors.phone = 'Enter exactly 10 digits'

  if (!form.password) errors.password = 'Password is required'
  else if (form.password.length < 6) errors.password = 'At least 6 characters'

  if (!form.batch) errors.batch = 'Please select a batch'
  return errors
}

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    batch: '', // nothing pre-selected — selection is mandatory
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitted(true)

    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      const profile = {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ''),
        batch: form.batch,
      }
      const { data, error: signErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: profile },
      })
      if (signErr) throw signErr

      if (data.session) {
        // No email confirmation required — go straight to first payment.
        await ensureProfile(profile)
        navigate('/first-payment', { replace: true })
      } else {
        // Email confirmation required: finish profile on first login.
        savePendingProfile(profile)
        setNotice('Account created. Please confirm your email, then log in to pay.')
      }
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Join the studio</h1>
        <p className="auth-sub">Create your account and pick a batch.</p>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Full name
          <input
            value={form.name}
            onChange={set('name')}
            className={errors.name ? 'invalid' : ''}
            autoComplete="name"
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            className={errors.email ? 'invalid' : ''}
            autoComplete="email"
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>

        <label>
          Phone
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={set('phone')}
            placeholder="10-digit mobile number"
            className={errors.phone ? 'invalid' : ''}
            autoComplete="tel"
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            className={errors.password ? 'invalid' : ''}
            autoComplete="new-password"
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        <div>
          <div className="legend" style={{ marginBottom: 10 }}>Choose your batch</div>
          <div className="batch-list">
            {BATCHES.map((b) => (
              <label
                key={b.id}
                className={`batch-opt ${form.batch === b.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="batch"
                  value={b.id}
                  checked={form.batch === b.id}
                  onChange={() => set('batch')(b.id)}
                />
                <span className="check">{form.batch === b.id ? <CheckIcon width={13} height={13} /> : ''}</span>
                <span className="b-name">{b.label}</span>
                <span className="b-price">{rupees(b.monthly * 100)}/mo</span>
              </label>
            ))}
          </div>
          {errors.batch && <span className="field-error">{errors.batch}</span>}
        </div>

        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up & continue'}
        </button>
      </form>

      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
