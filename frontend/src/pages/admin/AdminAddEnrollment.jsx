import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { MAX_JOIN_DATE } from '../../lib/joinDate'
import { useClasses, hasSlots, classById } from '../../lib/classes'
import BatchPicker from '../../components/BatchPicker'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

export default function AdminAddEnrollment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const { classes } = useClasses()
  const [enrolledIds, setEnrolledIds] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ batch: '', batch_slot: null, join_date: '' })

  useEffect(() => {
    adminApi(`/api/admin/students/${id}`)
      .then((data) => setEnrolledIds(new Set(data.enrollments.map((e) => e.batch))))
      .catch((e) => setError(e.message))
  }, [id])

  const availableClasses = useMemo(
    () => (classes ?? []).filter((c) => !enrolledIds || !enrolledIds.has(c.id)),
    [classes, enrolledIds],
  )

  async function onSubmit() {
    setError('')
    if (!form.batch) return setError('Please select a class')
    if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
      return setError('Please choose a timing')
    setBusy(true)
    try {
      await adminApi(`/api/admin/students/${id}/enrollments`, {
        method: 'POST',
        body: { batch: form.batch, batch_slot: form.batch_slot, join_date: form.join_date || null },
      })
      reloadStats()
      navigate(-1)
    } catch (e) {
      setError(e.message)
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

      {enrolledIds === null ? (
        <CardSkeleton lines={3} />
      ) : (
        <div className="form" style={{ marginTop: 8 }}>
          <BatchPicker
            classes={availableClasses}
            batch={form.batch}
            slot={form.batch_slot}
            onSelect={(batch, slot) => setForm((f) => ({ ...f, batch, batch_slot: slot }))}
          />
          <label>
            Join date <span className="muted small">(optional — defaults to today)</span>
            <input
              type="date"
              value={form.join_date}
              onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))}
              max={MAX_JOIN_DATE}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn primary block" onClick={onSubmit} disabled={busy}>
            {busy ? 'Adding…' : 'Add class'}
          </button>
          <button type="button" className="btn ghost block" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
