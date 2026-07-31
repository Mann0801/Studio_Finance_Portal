import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { toTenDigits } from '../../lib/auth'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import BatchPicker from '../../components/BatchPicker'
import { ArrowLeftIcon, CheckIcon } from '../../components/Icons'

function validate(form, classes) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter their full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (form.password && form.password.length < 8) errors.password = 'At least 8 characters'
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  return errors
}

/** Admin-only form to register a walk-in member (cash signups). */
export default function AddStudent() {
  const navigate = useNavigate()
  const { reloadStats, guard } = useAdmin()
  const { classes } = useClasses()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    batch: '',
    batch_slot: null,
    join_date: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { student, temp_password }
  const [copied, setCopied] = useState(false)

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
      const res = await adminApi('/api/admin/students', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
          batch_slot: form.batch_slot,
          join_date: form.join_date || null,
          password: form.password.trim() || null,
        },
      })
      reloadStats()
      setDone(res)
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function copyCreds() {
    const text = `Phone: ${done.student.phone}\nPassword: ${done.temp_password}`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (done) {
    return (
      <>
        <div className="topbar with-back">
          <button className="back-btn" aria-label="Back" onClick={() => navigate('/admin/students')}>
            <ArrowLeftIcon width={22} height={22} />
          </button>
          <div className="greeting">
            <h1>Student added</h1>
          </div>
        </div>

        <div className="profile-head">
          <div className="paid-badge"><CheckIcon width={26} height={26} /></div>
          <h2 className="profile-name" style={{ marginTop: 12 }}>{done.student.name}</h2>
          <div className="muted">
            {done.student.batch_label}
            {done.student.slot_label ? ` · ${done.student.slot_label}` : ''}
          </div>
        </div>

        {done.temp_password && (
          <div className="card" style={{ marginTop: 16 }}>
            <strong>Login details to share</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              Send these to {done.student.name.split(' ')[0]} so they can log in. They can
              change the password later from their profile.
            </p>
            <div className="card flush list" style={{ marginTop: 10 }}>
              <div className="list-item">
                <span className="muted">Phone</span>
                <span className="li-main" style={{ fontSize: 14 }}>{done.student.phone}</span>
              </div>
              <div className="list-item">
                <span className="muted">Password</span>
                <span className="li-main" style={{ fontSize: 14 }}>{done.temp_password}</span>
              </div>
            </div>
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={copyCreds}>
              {copied ? 'Copied ✓' : 'Copy login details'}
            </button>
          </div>
        )}

        <div className="stack" style={{ marginTop: 20, gap: 10 }}>
          <button
            className="btn primary block"
            onClick={() => navigate(`/admin/students/${done.student.id}`)}
          >
            View student
          </button>
          <button
            className="btn ghost block"
            onClick={() => {
              setDone(null)
              setSubmitted(false)
              setForm({ name: '', phone: '', batch: '', batch_slot: null, join_date: '', password: '' })
            }}
          >
            Add another
          </button>
        </div>
        <div style={{ height: 28 }} />
      </>
    )
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate('/admin/students')}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Add student</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate style={{ marginTop: 8 }}>
        <label>
          Full name
          <input value={form.name} onChange={set('name')} className={errors.name ? 'invalid' : ''} autoComplete="off" />
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
          Join date <span className="muted small">(optional — defaults to today)</span>
          <input type="date" value={form.join_date} onChange={set('join_date')} />
        </label>

        <label>
          Password <span className="muted small">(optional — auto-generated if blank)</span>
          <input
            type="text"
            value={form.password}
            onChange={set('password')}
            className={errors.password ? 'invalid' : ''}
            autoComplete="off"
            placeholder="Leave blank to generate one"
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </label>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Adding…' : 'Add student'}
        </button>
      </form>
      <div style={{ height: 28 }} />
    </>
  )
}
