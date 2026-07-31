import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { signUpWithPhone, setLastPhone, toTenDigits } from '../lib/auth'
import { useClasses, classById, hasSlots } from '../lib/classes'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import BatchPicker from '../components/BatchPicker'
import LegalFooter from '../components/LegalFooter'
import { MIN_JOIN_DATE, MAX_JOIN_DATE, joinDateError } from '../lib/joinDate'

const FIELD_ORDER = ['name', 'phone', 'password', 'confirm', 'batch', 'join_date']

function scrollToFirstError(errs) {
  const first = FIELD_ORDER.find((k) => errs[k])
  if (first) {
    document.getElementById(`f-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function validate(form, classes) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.password) errors.password = 'Set a password'
  else if (form.password.length < 8) errors.password = 'At least 8 characters'
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match'
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  const jd = joinDateError(form.join_date)
  if (jd) errors.join_date = jd
  return errors
}

export default function Signup() {
  const navigate = useNavigate()
  const { classes } = useClasses()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirm: '',
    batch: '',
    batch_slot: null,
    join_date: '',
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

  // Live confirm-password state (updates as they type).
  const confirmState = !form.confirm
    ? ''
    : form.confirm === form.password && form.password
      ? 'match'
      : 'mismatch'

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form, classes)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      scrollToFirstError(fieldErrors)
      return
    }

    setBusy(true)
    try {
      // 1) Create the account (phone + password → logs in immediately).
      await signUpWithPhone(form.phone, form.password)
      // 2) Create the student profile (idempotent, keyed to the verified user).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
          batch_slot: form.batch_slot,
          join_date: form.join_date,
        },
      })
      // 3) Straight to the dashboard with a quick welcome. The home screen shows
      //    the WhatsApp group prompt there (for classes that have a group).
      setLastPhone(form.phone.replace(/\D/g, ''))
      navigate('/', { replace: true, state: { welcome: true } })
    } catch (err) {
      setError(err.message || 'Could not create your account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap page">
      <div className="auth-brand">
        <img src={LOGO_SRC} alt="I'm Possible Fit" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Create your account</h1>
        <p className="auth-sub">A few details and you’re in.</p>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        <label id="f-name">
          Full name
          <input value={form.name} onChange={set('name')} className={errors.name ? 'invalid' : ''} autoComplete="name" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label id="f-phone">
          Phone number
          <div className={`phone-field ${errors.phone ? 'invalid' : ''}`}>
            <span className="phone-cc">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set('phone')(toTenDigits(e.target.value))}
              className={errors.phone ? 'invalid' : ''}
              placeholder="10-digit mobile number"
              autoComplete="tel"
            />
          </div>
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <label id="f-password">
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

        <label id="f-confirm">
          Confirm password
          <input
            type="password"
            value={form.confirm}
            onChange={set('confirm')}
            className={errors.confirm ? 'invalid' : confirmState === 'match' ? 'valid' : ''}
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />
          {errors.confirm ? (
            <span className="field-error">{errors.confirm}</span>
          ) : confirmState === 'match' ? (
            <span className="field-ok">Passwords match ✓</span>
          ) : confirmState === 'mismatch' ? (
            <span className="field-hint">Passwords don’t match yet</span>
          ) : null}
        </label>

        <div id="f-batch">
          <BatchPicker
            classes={classes}
            batch={form.batch}
            slot={form.batch_slot}
            error={errors.batch}
            onSelect={(batch, slot) => {
              setForm((f) => ({ ...f, batch, batch_slot: slot }))
              if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
            }}
          />
        </div>

        <label id="f-join_date">
          When did you first join the studio?
          <input
            type="date"
            value={form.join_date}
            onChange={set('join_date')}
            min={MIN_JOIN_DATE}
            max={MAX_JOIN_DATE}
            className={errors.join_date ? 'invalid' : ''}
          />
          <span className="field-hint">
            This is the date you started attending classes, not the date you are signing up.
          </span>
          {errors.join_date && <span className="field-error">{errors.join_date}</span>}
        </label>

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
