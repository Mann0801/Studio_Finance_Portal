import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import {
  FEE_TYPE_LABELS,
  daysLabel,
  priceLabel,
  slotsOf,
  slotTime,
  invalidateClasses,
} from '../../lib/classes'
import { EditIcon, TrashIcon, ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

/** One label/value line in the details card. */
function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="detail-row">
      <span className="dr-label">{label}</span>
      <span className="dr-value">{value}</span>
    </div>
  )
}

export default function AdminClassDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { guard, reloadStats } = useAdmin()
  const [cls, setCls] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Per-class WhatsApp group link — edited inline, separate from the class form.
  const [waEditing, setWaEditing] = useState(false)
  const [waDraft, setWaDraft] = useState('')
  const [waBusy, setWaBusy] = useState(false)
  const [waError, setWaError] = useState('')

  const load = useCallback(() => {
    adminApi('/api/admin/classes')
      .then((list) => {
        const found = list.find((c) => c.id === id)
        if (found) setCls(found)
        else setNotFound(true)
      })
      .catch(guard)
  }, [id, guard])
  useEffect(() => load(), [load])

  const startWaEdit = () => {
    setWaError('')
    setWaDraft(cls.whatsapp_group_url || '')
    setWaEditing(true)
  }

  async function saveWa() {
    setWaBusy(true)
    setWaError('')
    try {
      const updated = await adminApi(`/api/admin/classes/${id}/whatsapp`, {
        method: 'PATCH',
        body: { whatsapp_group_url: waDraft.trim() || null },
      })
      invalidateClasses()
      setCls(updated)
      setWaEditing(false)
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setWaError(err.message)
    } finally {
      setWaBusy(false)
    }
  }

  async function doDelete() {
    setBusy(true)
    setError('')
    try {
      await adminApi(`/api/admin/classes/${id}`, { method: 'DELETE' })
      invalidateClasses()
      reloadStats()
      navigate('/admin/classes')
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
      setBusy(false)
    }
  }

  const slots = cls ? slotsOf(cls) : []
  const timing =
    cls && !slots.length && cls.start_time && cls.end_time
      ? `${cls.start_time} – ${cls.end_time}`
      : ''

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate('/admin/classes')}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>{cls ? cls.name : 'Class'}</h1>
        </div>
      </div>

      {notFound ? (
        <div className="card empty">Class not found.</div>
      ) : !cls ? (
        <CardSkeleton lines={5} />
      ) : (
        <>
          <div className="card">
            <div className="detail-list">
              <Row label="Fee type" value={FEE_TYPE_LABELS[cls.fee_type] || cls.fee_type} />
              <Row label="Price" value={priceLabel(cls)} />
              <Row label="Schedule days" value={daysLabel(cls.schedule_days)} />
              <Row label="Timing" value={timing} />
              <Row
                label="Students"
                value={`${cls.student_count} student${cls.student_count === 1 ? '' : 's'}`}
              />
              <Row label="Description" value={cls.description} />
            </div>

            {slots.length > 0 && (
              <div className="detail-slots">
                <div className="dr-label" style={{ marginBottom: 8 }}>Timing slots</div>
                {slots.map((s) => (
                  <div className="between slot-row" key={s.key}>
                    <span>{s.name}</span>
                    <span className="muted small">{slotTime(s) || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp group — managed here per class, with its own edit */}
          <div className="card wa-admin-card" style={{ marginTop: 14, marginBottom: 0 }}>
            <div className="between">
              <span className="card-title">WhatsApp group</span>
              {!waEditing && (
                <button className="btn ghost sm" onClick={startWaEdit}>
                  Edit
                </button>
              )}
            </div>
            {waEditing ? (
              <div className="wa-admin-edit">
                <input
                  className="wa-admin-input"
                  value={waDraft}
                  onChange={(e) => setWaDraft(e.target.value)}
                  placeholder="https://chat.whatsapp.com/…"
                  autoFocus
                />
                {waError && <p className="error" style={{ marginBottom: 0 }}>{waError}</p>}
                <div className="wa-admin-actions">
                  <button className="btn primary sm" disabled={waBusy} onClick={saveWa}>
                    {waBusy ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn ghost sm" disabled={waBusy} onClick={() => setWaEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : cls.whatsapp_group_url ? (
              <a
                className="wa-admin-link"
                href={cls.whatsapp_group_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {cls.whatsapp_group_url}
              </a>
            ) : (
              <span className="muted small">No group link set</span>
            )}
          </div>

          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <button
              className="btn primary block"
              onClick={() => navigate(`/admin/classes/${id}/edit`)}
            >
              <EditIcon width={18} height={18} /> Edit class
            </button>
            <button className="btn danger-outline block" onClick={() => setConfirm(true)}>
              <TrashIcon width={18} height={18} /> Delete class
            </button>
          </div>

          {confirm && (
            <div className="card" style={{ borderColor: 'var(--unpaid)', marginTop: 12 }}>
              <p style={{ marginTop: 0, lineHeight: 1.5 }}>
                {cls.student_count > 0
                  ? `${cls.student_count} student${cls.student_count === 1 ? ' is' : 's are'} in ${cls.name}. They'll be flagged "Batch Deleted" and need reassigning from their profile.`
                  : `Remove ${cls.name}? It has no students and will leave the signup page.`}
              </p>
              {error && <p className="error">{error}</p>}
              <div className="stack" style={{ gap: 8 }}>
                <button className="btn danger block" onClick={doDelete} disabled={busy}>
                  {busy ? 'Deleting…' : 'Yes, delete class'}
                </button>
                <button className="btn ghost block" onClick={() => setConfirm(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
