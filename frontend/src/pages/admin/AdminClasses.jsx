import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { invalidateClasses, priceLabel, scheduleLabel } from '../../lib/classes'
import { PlusIcon, EditIcon, TrashIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

export default function AdminClasses() {
  const navigate = useNavigate()
  const { guard, reloadStats } = useAdmin()
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi('/api/admin/classes').then(setClasses).catch(guard)
  }, [guard])
  useEffect(() => load(), [load])

  const activeClasses = (classes || []).filter((c) => c.active)

  async function doDelete(c) {
    setBusy(true)
    try {
      await adminApi(`/api/admin/classes/${c.id}`, { method: 'DELETE' })
      invalidateClasses()
      reloadStats()
      setConfirmId(null)
      load()
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting"><h1>Classes</h1></div>
      </div>

      <button
        className="btn primary block"
        style={{ marginBottom: 14 }}
        onClick={() => navigate('/admin/classes/new')}
      >
        <PlusIcon width={18} height={18} /> Add New Class
      </button>

      {error && <p className="error">{error}</p>}

      {classes === null ? (
        <ListSkeleton rows={5} />
      ) : activeClasses.length === 0 ? (
        <div className="card empty">No classes yet — tap “Add New Class”.</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {activeClasses.map((c) => (
            <div key={c.id}>
              <div className="class-card">
                <div className="cc-main">
                  <div className="cc-name">{c.name}</div>
                  {scheduleLabel(c) && <div className="cc-sched">{scheduleLabel(c)}</div>}
                  <div className="cc-meta">
                    <span className="cc-fee">{priceLabel(c)}</span>
                    <span className="cc-count">
                      {c.student_count} student{c.student_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="cc-actions">
                  <button
                    className="icon-btn"
                    aria-label="Edit"
                    onClick={() => navigate(`/admin/classes/${c.id}`)}
                  >
                    <EditIcon width={18} height={18} />
                  </button>
                  <button
                    className="icon-btn danger"
                    aria-label="Delete"
                    onClick={() => setConfirmId(confirmId === c.id ? null : c.id)}
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                </div>
              </div>

              {confirmId === c.id && (
                <div className="card" style={{ borderColor: 'var(--unpaid)', marginTop: 8 }}>
                  <p style={{ marginTop: 0, lineHeight: 1.5 }}>
                    {c.student_count > 0
                      ? `${c.student_count} student${c.student_count === 1 ? ' is' : 's are'} in ${c.name}. They'll be flagged "Batch Deleted" and need reassigning from their profile.`
                      : `Remove ${c.name}? It has no students and will leave the signup page.`}
                  </p>
                  <div className="stack" style={{ gap: 8 }}>
                    <button className="btn danger block" onClick={() => doDelete(c)} disabled={busy}>
                      {busy ? 'Deleting…' : 'Yes, delete class'}
                    </button>
                    <button className="btn ghost block" onClick={() => setConfirmId(null)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
