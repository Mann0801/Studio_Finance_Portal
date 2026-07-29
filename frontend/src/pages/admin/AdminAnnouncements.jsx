import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { MegaphoneIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function AdminAnnouncements() {
  const { guard } = useAdmin()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(() => {
    adminApi('/api/admin/announcements').then(setItems).catch(guard)
  }, [guard])
  useEffect(() => load(), [load])

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      load()
    } catch (e) {
      if (/expired|log in/i.test(e.message)) guard(e)
      else setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const post = () =>
    run(async () => {
      await adminApi('/api/admin/announcements', { method: 'POST', body: { message: text.trim() } })
      setText('')
    })

  const saveEdit = (id) =>
    run(async () => {
      await adminApi(`/api/admin/announcements/${id}`, { method: 'PATCH', body: { message: editText.trim() } })
      setEditingId(null)
    })

  const remove = (id) =>
    run(async () => {
      await adminApi(`/api/admin/announcements/${id}`, { method: 'DELETE' })
      setConfirmId(null)
    })

  const activate = (id) =>
    run(() => adminApi(`/api/admin/announcements/${id}/activate`, { method: 'POST' }))

  return (
    <>
      <div className="topbar">
        <div className="greeting"><h1>Announcements</h1></div>
      </div>

      {/* Composer */}
      <div className="card">
        <strong>New announcement</strong>
        <textarea
          value={text}
          maxLength={500}
          placeholder="e.g. Studio closed on 26th for maintenance."
          onChange={(e) => setText(e.target.value)}
          style={{ marginTop: 10 }}
        />
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={post} disabled={busy || !text.trim()}>
          {busy ? 'Posting…' : 'Post to all students'}
        </button>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          The newest announcement shows as the banner in the student app.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
        <h2>All announcements</h2>
      </div>

      {items === null ? (
        <ListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <div className="card empty">No announcements yet.</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {items.map((a) => (
            <div className="card announce-item" key={a.id}>
              <div className="ann-top">
                <MegaphoneIcon className="ann-ic" width={17} height={17} />
                {a.active && <span className="ann-latest">Live</span>}
                <span className="ann-date">{fmt(a.created_at)}</span>
              </div>

              {editingId === a.id ? (
                <>
                  <textarea
                    value={editText}
                    maxLength={500}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn primary sm" onClick={() => saveEdit(a.id)} disabled={busy || !editText.trim()}>
                      Save
                    </button>
                    <button className="btn ghost sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : confirmId === a.id ? (
                <div className="card" style={{ borderColor: 'var(--unpaid)', marginTop: 8 }}>
                  <p style={{ marginTop: 0 }}>Delete this announcement permanently?</p>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn danger sm" onClick={() => remove(a.id)} disabled={busy}>Delete</button>
                    <button className="btn ghost sm" onClick={() => setConfirmId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="ann-msg">{a.message}</p>
                  <div className="row" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                    {!a.active && (
                      <button className="link-btn" onClick={() => activate(a.id)} disabled={busy}>
                        Set as banner
                      </button>
                    )}
                    <button
                      className="link-btn"
                      onClick={() => {
                        setEditingId(a.id)
                        setEditText(a.message)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="link-btn"
                      style={{ color: 'var(--unpaid)' }}
                      onClick={() => setConfirmId(a.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
