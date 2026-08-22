import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import BatchPicker from '../../components/BatchPicker'
import { ArrowLeftIcon } from '../../components/Icons'
import { MIN_JOIN_DATE, MAX_JOIN_DATE, joinDateError } from '../../lib/joinDate'
import { CardSkeleton } from '../../components/Skeleton'

function validate(form, classes) {
  const errors = {}
  if (!form.batch) errors.batch = 'Please select a class'
  else if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
    errors.batch = 'Please choose a timing'
  const jd = joinDateError(form.join_date)
  if (jd) errors.join_date = jd
  return errors
}

// Reachable from the student hamburger menu — join one more class. Add-only:
// removing a class is an admin action.
export default function AddClass() {
  const navigate = useNavigate()
  const { data, loading, reload, setActiveClassId } = useDashboard()
  const { classes } = useClasses()
  const [form, setForm] = useState({ batch: '', batch_slot: null, join_date: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const enrolledIds = useMemo(
    () => new Set((data?.enrollments ?? []).map((e) => e.batch)),
    [data],
  )
  const available = useMemo(
    () => (classes ?? []).filter((c) => !enrolledIds.has(c.id)),
    [classes, enrolledIds],
  )

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form, available)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      await api('/api/me/classes', {
        method: 'POST',
        body: {
          batch: form.batch,
          batch_slot: form.batch_slot,
          join_date: form.join_date,
        },
      })
      await reload()
      setActiveClassId(form.batch)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not add this class')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Add a class</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={3} />}

      {!loading && data && available.length === 0 && (
        <div className="card empty">You're already enrolled in every class we offer.</div>
      )}

      {!loading && data && available.length > 0 && (
        <form onSubmit={onSubmit} className="form" noValidate style={{ marginTop: 8 }}>
          <BatchPicker
            classes={available}
            batch={form.batch}
            slot={form.batch_slot}
            error={errors.batch}
            onSelect={(batch, slot) => {
              setForm((f) => ({ ...f, batch, batch_slot: slot }))
              if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
            }}
          />

          <label>
            When did you start this class?
            <input
              type="date"
              value={form.join_date}
              onChange={set('join_date')}
              min={MIN_JOIN_DATE}
              max={MAX_JOIN_DATE}
              className={errors.join_date ? 'invalid' : ''}
            />
            {errors.join_date && <span className="field-error">{errors.join_date}</span>}
          </label>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary lg block" disabled={busy}>
            {busy ? 'Adding…' : 'Add class'}
          </button>
        </form>
      )}
    </>
  )
}
