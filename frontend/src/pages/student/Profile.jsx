import { useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { changePassword, toTenDigits } from '../../lib/auth'
import {
  useClasses,
  classById,
  hasSlots,
  scheduleLabel,
  priceLabel,
  slotByKey,
  slotTime,
} from '../../lib/classes'
import BatchPicker from '../../components/BatchPicker'
import { ChevronDownIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

function validate(form, classes) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  // Password is optional — only validated if they typed a new one.
  if (form.newPassword) {
    if (form.newPassword.length < 8) errors.newPassword = 'At least 8 characters'
    if (form.confirmPassword !== form.newPassword) errors.confirmPassword = 'Passwords do not match'
  }
  return errors
}

export default function Profile() {
  const { data, loading, error, reload } = useDashboard()
  const { classes } = useClasses()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [classOpen, setClassOpen] = useState(false) // is the class picker expanded

  const startEdit = () => {
    const s = data.student
    setForm({
      name: s.name,
      // Stored with country code (91…); show just the 10 digits for editing.
      phone: (s.phone || '').replace(/\D/g, '').slice(-10),
      batch: s.batch,
      batch_slot: s.batch_slot || null,
      newPassword: '',
      confirmPassword: '',
    })
    setErrors({})
    setSubmitted(false)
    setSaveError('')
    setClassOpen(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm(null)
    setClassOpen(false)
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

  const selectedCls = form ? classById(classes, form.batch) : null

  async function onSubmit(e) {
    e.preventDefault()
    setSaveError('')
    setSubmitted(true)
    const fieldErrors = validate(form, classes)
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
          batch: form.batch,
          batch_slot: form.batch_slot,
        },
      })
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
                {data.student.batch_label}
                {data.student.slot_label ? ` · ${data.student.slot_label}` : ' class'}
              </div>
            </div>
          </div>

          <div className="card flush list">
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.phone}</span>
            </div>
            <div className="list-item">
              <span className="muted">Class</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {data.student.batch_label}
                {data.student.slot_label ? ` · ${data.student.slot_label}` : ''}
              </span>
            </div>
            <div className="list-item">
              <span className="muted">Joined</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {new Date(data.student.join_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

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

          {/* Class — collapsed summary that expands into the detailed picker */}
          <div>
            {classOpen ? (
              <BatchPicker
                classes={classes}
                batch={form.batch}
                slot={form.batch_slot}
                error={errors.batch}
                onSelect={(batch, slot) => {
                  setForm((f) => ({ ...f, batch, batch_slot: slot }))
                  if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
                  const cls = classById(classes, batch)
                  if (!hasSlots(cls) || slot) setClassOpen(false) // collapse once fully chosen
                }}
              />
            ) : (
              <>
                <div className="legend" style={{ marginBottom: 8 }}>Class</div>
                <button
                  type="button"
                  className={`class-select-btn ${errors.batch ? 'invalid' : ''}`}
                  onClick={() => setClassOpen(true)}
                >
                  <span className="cs-main">
                    <span className="cs-name">{selectedCls ? selectedCls.name : 'Select a class'}</span>
                    {selectedCls && (
                      <span className="cs-sub">
                        {[
                          scheduleLabel(selectedCls),
                          form.batch_slot ? slotTime(slotByKey(selectedCls, form.batch_slot)) : '',
                          priceLabel(selectedCls),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                  <ChevronDownIcon className="cs-chev" width={20} height={20} />
                </button>
                {errors.batch && <span className="field-error">{errors.batch}</span>}
              </>
            )}
          </div>

          <p className="muted small" style={{ margin: '2px 0' }}>
            Changing your class updates this month’s fee on your next visit to Home.
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
