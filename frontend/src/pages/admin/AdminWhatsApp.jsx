import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/adminApi'
import { CardSkeleton } from '../../components/Skeleton'

// Admin management of each class's WhatsApp group link. Editing a link switches
// the group students join — they pick up the new link on their next app load.
export default function AdminWhatsApp() {
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // class id being edited
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let on = true
    adminApi('/api/admin/classes')
      .then((rows) => on && setClasses(rows.filter((c) => c.active)))
      .catch((e) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  const startEdit = (c) => {
    setError('')
    setEditing(c.id)
    setDraft(c.whatsapp_group_url || '')
  }
  const cancel = () => {
    setEditing(null)
    setDraft('')
  }

  const save = async (id) => {
    setBusy(true)
    setError('')
    try {
      const updated = await adminApi(`/api/admin/classes/${id}/whatsapp`, {
        method: 'PATCH',
        body: { whatsapp_group_url: draft.trim() || null },
      })
      setClasses((cs) => cs.map((c) => (c.id === id ? updated : c)))
      cancel()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>WhatsApp Groups</h1>
        </div>
      </div>

      <p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.5, fontSize: 13.5 }}>
        Set or switch each class’s WhatsApp group link. Students who tap “Join Group” go to whatever
        link is saved here — a change reflects on their next app open.
      </p>

      {error && <p className="error">{error}</p>}
      {!classes && <CardSkeleton lines={2} />}

      {classes &&
        classes.map((c) => (
          <div className="card wa-admin-card" key={c.id}>
            <div className="between">
              <span className="card-title">{c.name}</span>
              {editing !== c.id && (
                <button className="btn ghost sm" onClick={() => startEdit(c)}>
                  Edit
                </button>
              )}
            </div>

            {editing === c.id ? (
              <div className="wa-admin-edit">
                <input
                  className="wa-admin-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="https://chat.whatsapp.com/…"
                  autoFocus
                />
                <div className="wa-admin-actions">
                  <button className="btn primary sm" disabled={busy} onClick={() => save(c.id)}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn ghost sm" disabled={busy} onClick={cancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : c.whatsapp_group_url ? (
              <a
                className="wa-admin-link"
                href={c.whatsapp_group_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.whatsapp_group_url}
              </a>
            ) : (
              <span className="muted small">No group link set</span>
            )}
          </div>
        ))}
    </>
  )
}
