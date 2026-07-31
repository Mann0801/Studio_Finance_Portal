import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setLastPhone, toTenDigits } from '../lib/auth'
import { useClasses, classById, hasSlots } from '../lib/classes'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import BatchPicker from '../components/BatchPicker'
import { MIN_JOIN_DATE, MAX_JOIN_DATE, joinDateError } from '../lib/joinDate'
import { whatsappGroupLink } from '../lib/whatsapp'

function validate(form, classes) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  const jd = joinDateError(form.join_date)
  if (jd) errors.join_date = jd
  return errors
}

// Fallback screen: reached only when an authenticated user has no students row
// yet (e.g. signup created the auth account but /api/signup didn't finish). The
// password is already set during signup, so we only collect the profile here.
export default function ProfileSetup() {
  const navigate = useNavigate()
  const { classes } = useClasses()
  const [form, setForm] = useState({
    name: '',
    phone: '',
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

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form, classes)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      // Create the student profile (idempotent, keyed to the verified user).
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
      setLastPhone(form.phone.replace(/\D/g, ''))
      if (whatsappGroupLink(form.batch)) {
        navigate('/welcome-whatsapp', { replace: true, state: { batch: form.batch } })
      } else {
        navigate('/', { replace: true, state: { welcome: true } })
      }
    } catch (err) {
      setError(err.message || 'Could not complete setup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap page">
      <div className="auth-brand">
        <img src={LOGO_SRC} alt="I'm Possible Fit" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Set up your profile</h1>
        <p className="auth-sub">A few details and you’re in.</p>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Full name
          <input value={form.name} onChange={set('name')} className={errors.name ? 'invalid' : ''} autoComplete="name" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Phone
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

        <label>
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
      </form>
    </div>
  )
}
