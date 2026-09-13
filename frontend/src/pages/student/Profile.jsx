import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { changePassword, formatPhoneDisplay, toTenDigits } from '../../lib/auth'
import { PlusIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  // Optional — only validated if they've typed something.
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address'
  // Password is optional — only validated if they typed a new one.
  if (form.newPassword) {
    if (form.newPassword.length < 8) errors.newPassword = 'At least 8 characters'
    if (form.confirmPassword !== form.newPassword) errors.confirmPassword = 'Passwords do not match'
  }
  return errors
}

export default function Profile() {
  const { data, loading, error, reload } = useDashboard()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')

  const startEdit = () => {
    const s = data.student
    setForm({
      name: s.name,
      // Stored with country code (91…); show just the 10 digits for editing.
      phone: (s.phone || '').replace(/\D/g, '').slice(-10),
      email: s.email || '',
      newPassword: '',
      confirmPassword: '',
    })
    setErrors({})
    setSubmitted(false)
    setSaveError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm(null)
  }

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  // Live confirm-password state within the edit form.
  const confirmState = !form?.confirmPassword
    ? ''
    : form.confirmPassword === form.newPassword && form.newPassword
      ? 'match'
      : 'mismatch'

  async function onSubmit(e) {
    e.preventDefault()
    setSaveError('')
    setSubmitted(true)
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      // Change the password first (if provided) so a "same as old" rejection
      // stops here before we save anything else.
      if (form.newPassword) {
        await changePassword(form.newPassword)
      }
      await api('/api/me/profile', {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
        },
      })
      // Sent unconditionally, including empty — clearing it here brings
      // back the Home banner since the student no longer has one on file.
      await api('/api/me/email', { method: 'PATCH', body: { email: form.email.trim() } })
      await reload()
      setEditing(false)
      setForm(null)
    } catch (err) {
      const msg = err.message || 'Could not save your changes'
      // Surface a password problem on the field so they can fix + re-confirm.
      if (/password/i.test(msg)) {
        setErrors((prev) => ({ ...prev, newPassword: msg }))
      } else {
        setSaveError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const enrollments = data?.enrollments ?? []

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Settings</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={3} />}
      {error && <p className="error">{error}</p>}

      {data && !editing && (
        <div className="stack">
          <div className="card row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 54, height: 54, fontSize: 22 }}>
              {data.student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{data.student.name}</div>
              <div className="muted small">
                {enrollments.length} class{enrollments.length === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          <div className="card flush list">
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{formatPhoneDisplay(data.student.phone)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Recovery email</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {data.student.email || 'Not added'}
              </span>
            </div>
          </div>

          {enrollments.length > 0 && (
            <div className="card flush">
              <div className="data-row head">
                <span>Class</span>
                <span>Timing</span>
                <span style={{ textAlign: 'right' }}>Joined</span>
              </div>
              {enrollments.map((en) => (
                <div className="data-row static" key={en.batch}>
                  <span className="data-name">{en.batch_label}</span>
                  <span className="data-sub">{en.slot_label || '—'}</span>
                  <div className="data-end">
                    {new Date(en.join_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/add-class" className="btn ghost block">
            <PlusIcon width={16} height={16} /> Add a class
          </Link>

          <button className="btn primary block" onClick={startEdit}>
            Edit profile
          </button>
        </div>
      )}

      {data && editing && form && (
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

          <label>
            Recovery email
            <input
              type="email"
              inputMode="email"
              value={form.email}
              onChange={set('email')}
              className={errors.email ? 'invalid' : ''}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <span className="field-hint">Used only for password recovery.</span>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>

          {/* Change password (optional) */}
          <div className="section-h" style={{ marginTop: 4, marginBottom: 0 }}>
            <h2 style={{ fontSize: 15 }}>Change password</h2>
          </div>
          <label>
            New password <span className="muted small">(leave blank to keep current)</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={set('newPassword')}
              className={errors.newPassword ? 'invalid' : ''}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {errors.newPassword && <span className="field-error">{errors.newPassword}</span>}
          </label>

          {form.newPassword && (
            <label>
              Confirm new password
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                className={
                  errors.confirmPassword ? 'invalid' : confirmState === 'match' ? 'valid' : ''
                }
                autoComplete="new-password"
                placeholder="Re-enter new password"
              />
              {errors.confirmPassword ? (
                <span className="field-error">{errors.confirmPassword}</span>
              ) : confirmState === 'match' ? (
                <span className="field-ok">Passwords match ✓</span>
              ) : confirmState === 'mismatch' ? (
                <span className="field-hint">Passwords don’t match yet</span>
              ) : null}
            </label>
          )}

          <p className="muted small" style={{ margin: '2px 0' }}>
            To change your class, use "Add a class" from the menu, or contact the studio.
          </p>

          {saveError && <p className="error">{saveError}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="btn ghost block" onClick={cancelEdit} disabled={busy}>
            Cancel
          </button>
        </form>
      )}
    </>
  )
}
