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

const FIELD_ORDER = ['name', 'phone', 'password', 'confirm', 'classes', 'join_date']

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
  if (form.classes.length === 0) errors.classes = 'Please select at least one class'
  else if (form.classes.some((c) => hasSlots(classById(classes, c.batch)) && !c.batch_slot))
    errors.classes = 'Please choose a timing for every selected class'
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
    classes: [], // [{ batch, batch_slot }]
    join_date: '',
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
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
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  const toggleClass = (batch) => {
    setForm((f) => {
      const exists = f.classes.some((c) => c.batch === batch)
      const nextClasses = exists
        ? f.classes.filter((c) => c.batch !== batch)
        : [...f.classes, { batch, batch_slot: null }]
      return { ...f, classes: nextClasses }
    })
    if (submitted) setErrors((prev) => ({ ...prev, classes: undefined }))
  }

  const selectSlot = (batch, slot) => {
    setForm((f) => ({
      ...f,
      classes: f.classes.map((c) => (c.batch === batch ? { ...c, batch_slot: slot } : c)),
    }))
    if (submitted) setErrors((prev) => ({ ...prev, classes: undefined }))
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
      // 2) Create the student profile + chosen class(es) (idempotent, keyed to
      //    the verified user).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
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

        <div id="f-classes">
          <BatchPicker
            classes={classes}
            multiple
            selected={form.classes}
            error={errors.classes}
            onToggle={toggleClass}
            onSlotSelect={selectSlot}
          />
        </div>

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

        <label id="f-join_date">
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
