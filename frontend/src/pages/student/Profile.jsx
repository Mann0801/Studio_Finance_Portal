import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import BatchPicker from '../../components/BatchPicker'
import { CardSkeleton } from '../../components/Skeleton'

function validate(form, classes) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  return errors
}

export default function Profile() {
  const { signOut } = useAuth()
  const { data, loading, error, reload } = useDashboard()
  const { classes } = useClasses()

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
      phone: s.phone,
      batch: s.batch,
      batch_slot: s.batch_slot || null,
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

  async function onSubmit(e) {
    e.preventDefault()
    setSaveError('')
    setSubmitted(true)
    const fieldErrors = validate(form, classes)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
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
      setSaveError(err.message || 'Could not save your changes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Profile</h1>
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
                {data.student.slot_label ? ` · ${data.student.slot_label}` : ' batch'}
              </div>
            </div>
          </div>

          <div className="card flush list">
            {data.student.email && (
              <div className="list-item">
                <span className="muted">Email</span>
                <span className="li-main" style={{ fontSize: 14 }}>{data.student.email}</span>
              </div>
            )}
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.phone}</span>
            </div>
            <div className="list-item">
              <span className="muted">Batch</span>
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
          <button className="btn danger block" onClick={signOut}>
            Log out
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
            classes={classes}
            batch={form.batch}
            slot={form.batch_slot}
            error={errors.batch}
            onSelect={(batch, slot) => {
              setForm((f) => ({ ...f, batch, batch_slot: slot }))
              if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
            }}
          />

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
