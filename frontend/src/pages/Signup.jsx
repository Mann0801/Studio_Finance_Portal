import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { signUpWithPhone, setLastPhone, toTenDigits } from '../lib/auth'
import { useClasses, classById, hasSlots } from '../lib/classes'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import BatchPicker from '../components/BatchPicker'
import LegalFooter from '../components/LegalFooter'
import JoinDateNoticeModal from '../components/JoinDateNoticeModal'
import { InfoIcon } from '../components/Icons'
import { MIN_JOIN_DATE, MAX_JOIN_DATE, FIRST_OF_THIS_MONTH_LABEL, joinDateError } from '../lib/joinDate'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const STEPS = ['Your details', 'Account security', 'Choose a class', 'Join date']
const TOTAL_STEPS = STEPS.length

function validateStep1(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  return errors
}

function validateStep2(form) {
  const errors = {}
  if (!form.email.trim()) errors.email = 'Please enter an email'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address'
  if (!form.password) errors.password = 'Set a password'
  else if (form.password.length < 8) errors.password = 'At least 8 characters'
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match'
  return errors
}

function validateStep3(form, classes) {
  const errors = {}
  if (form.classes.length === 0) errors.classes = 'Please select at least one class'
  else if (form.classes.some((c) => hasSlots(classById(classes, c.batch)) && !c.batch_slot))
    errors.classes = 'Please choose a timing for every selected class'
  return errors
}

function validateStep4(form) {
  const errors = {}
  const jd = joinDateError(form.join_date)
  if (jd) errors.join_date = jd
  return errors
}

function validateAll(form, classes) {
  return {
    ...validateStep1(form),
    ...validateStep2(form),
    ...validateStep3(form, classes),
    ...validateStep4(form),
  }
}

export default function Signup() {
  const navigate = useNavigate()
  const { classes } = useClasses()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirm: '',
    classes: [], // [{ batch, batch_slot }]
    join_date: '',
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The join-date notice must be acknowledged (blocking) before the date
  // picker opens the first time; the input stays read-only until then.
  const [joinDateAcked, setJoinDateAcked] = useState(false)
  const [showJoinDateNotice, setShowJoinDateNotice] = useState(false)
  const joinDateRef = useRef(null)
  useEffect(() => {
    if (joinDateAcked) {
      joinDateRef.current?.focus()
      joinDateRef.current?.showPicker?.()
    }
  }, [joinDateAcked])

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const toggleClass = (batch) => {
    setForm((f) => {
      const exists = f.classes.some((c) => c.batch === batch)
      const nextClasses = exists
        ? f.classes.filter((c) => c.batch !== batch)
        : [...f.classes, { batch, batch_slot: null }]
      return { ...f, classes: nextClasses }
    })
    setErrors((prev) => ({ ...prev, classes: undefined }))
  }

  const selectSlot = (batch, slot) => {
    setForm((f) => ({
      ...f,
      classes: f.classes.map((c) => (c.batch === batch ? { ...c, batch_slot: slot } : c)),
    }))
    setErrors((prev) => ({ ...prev, classes: undefined }))
  }

  // Live confirm-password state (updates as they type).
  const confirmState = !form.confirm
    ? ''
    : form.confirm === form.password && form.password
      ? 'match'
      : 'mismatch'

  function goNext() {
    setError('')
    const stepErrors =
      step === 1 ? validateStep1(form) : step === 2 ? validateStep2(form) : validateStep3(form, classes)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setError('')
    setStep((s) => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const step4Errors = validateStep4(form)
    setErrors(step4Errors)
    if (Object.keys(step4Errors).length > 0) return
    // Defensive final check in case something upstream got out of sync.
    const allErrors = validateAll(form, classes)
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      setStep(1)
      return
    }

    setBusy(true)
    try {
      // 1) Create the account (phone + password → logs in immediately).
      await signUpWithPhone(form.phone, form.password)
      // 2) Create the student profile + chosen class(es) (idempotent, keyed to
      //    the verified user).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          email: form.email.trim(),
          classes: form.classes,
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

      <div className="signup-progress">
        <div className="signup-progress-label">
          <span>{STEPS[step - 1]}</span>
          <span className="muted small">Step {step} of {TOTAL_STEPS}</span>
        </div>
        <div className="bar">
          <span style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        {step === 1 && (
          <div key="step1" className="auth-step-in">
            <label>
              Full name
              <input
                value={form.name}
                onChange={set('name')}
                className={errors.name ? 'invalid' : ''}
                autoComplete="name"
                autoFocus
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>

            <label>
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

            <button type="button" className="btn primary lg block" onClick={goNext}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div key="step2" className="auth-step-in">
            <label>
              Email
              <input
                type="email"
                inputMode="email"
                value={form.email}
                onChange={set('email')}
                className={errors.email ? 'invalid' : ''}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
              <span className="field-hint">Used only for password recovery.</span>
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

            <div className="stack" style={{ gap: 10 }}>
              <button type="button" className="btn primary lg block" onClick={goNext}>
                Continue
              </button>
              <button type="button" className="btn ghost block" onClick={goBack}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div key="step3" className="auth-step-in">
            <BatchPicker
              classes={classes}
              multiple
              selected={form.classes}
              error={errors.classes}
              onToggle={toggleClass}
              onSlotSelect={selectSlot}
            />

            <div className="stack" style={{ gap: 10, marginTop: 16 }}>
              <button type="button" className="btn primary lg block" onClick={goNext}>
                Continue
              </button>
              <button type="button" className="btn ghost block" onClick={goBack}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div key="step4" className="auth-step-in">
            <div className="card notice-card">
              <InfoIcon className="notice-icon" width={22} height={22} />
              <div>
                <strong>Already a member of the studio?</strong>
                <p>
                  As your payments and records move onto the app, please set your join date to{' '}
                  <strong>{FIRST_OF_THIS_MONTH_LABEL}</strong> so this month is billed in full rather
                  than as a partial amount.
                </p>
                <p>
                  <strong>New to the studio?</strong> Please choose the date you actually started
                  attending classes, not the date you're signing up for this app.
                </p>
              </div>
            </div>

            <label>
              Studio join date
              <div className="date-field-wrap">
                <input
                  ref={joinDateRef}
                  type="date"
                  value={form.join_date}
                  onChange={set('join_date')}
                  min={MIN_JOIN_DATE}
                  max={MAX_JOIN_DATE}
                  className={errors.join_date ? 'invalid' : ''}
                  readOnly={!joinDateAcked}
                  onFocus={() => !joinDateAcked && setShowJoinDateNotice(true)}
                />
                {!joinDateAcked && (
                  <div
                    className="date-field-shield"
                    onClick={() => setShowJoinDateNotice(true)}
                  />
                )}
              </div>
              {form.classes.length > 1 && (
                <span className="field-hint">It applies to every class you selected above.</span>
              )}
              {errors.join_date && <span className="field-error">{errors.join_date}</span>}
            </label>

            {error && <p className="error">{error}</p>}
            <div className="stack" style={{ gap: 10 }}>
              <button type="submit" className="btn primary lg block" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
              <button type="button" className="btn ghost block" onClick={goBack} disabled={busy}>
                Back
              </button>
            </div>
            <p className="consent-note">
              By creating an account you agree to our <Link to="/terms">Terms</Link> and{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        )}
      </form>

      <p className="auth-foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>

      <LegalFooter />

      <JoinDateNoticeModal
        open={showJoinDateNotice}
        onOk={() => {
          setShowJoinDateNotice(false)
          setJoinDateAcked(true)
        }}
      />
    </div>
  )
}
