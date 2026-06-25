import { useCallback, useEffect, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { STUDIO_NAME } from '../../lib/brand'
import { MegaphoneIcon } from '../../components/Icons'

function AnnouncementManager() {
  const [ann, setAnn] = useState(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi('/api/admin/announcement').then(setAnn).catch(() => {})
  }, [])
  useEffect(() => load(), [load])

  async function save() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const saved = await adminApi('/api/admin/announcement', {
        method: ann ? 'PUT' : 'POST',
        body: { message: text.trim() },
      })
      setAnn(saved)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await adminApi('/api/admin/announcement', { method: 'DELETE' })
      setAnn(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="between" style={{ marginBottom: ann ? 12 : 0 }}>
        <div className="row" style={{ gap: 10 }}>
          <MegaphoneIcon width={20} height={20} style={{ color: 'var(--accent-bright)' }} />
          <strong>Announcement</strong>
        </div>
        <button
          className="btn"
          style={{ minHeight: 40, padding: '0 14px' }}
          onClick={() => {
            setText(ann?.message || '')
            setEditing(true)
          }}
        >
          {ann ? 'Edit' : 'Post'}
        </button>
      </div>
      {ann ? (
        <>
          <p className="muted" style={{ fontSize: 14 }}>{ann.message}</p>
          <button
            className="link-btn"
            style={{ color: 'var(--unpaid)', marginTop: 8, paddingLeft: 0 }}
            onClick={remove}
            disabled={busy}
          >
            Delete announcement
          </button>
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 6 }}>No active announcement.</p>
      )}

      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>{ann ? 'Edit' : 'New'} announcement</h2>
            <textarea
              value={text}
              maxLength={500}
              placeholder="e.g. Studio closed on 26th for maintenance."
              onChange={(e) => setText(e.target.value)}
            />
            <div className="stack" style={{ marginTop: 14 }}>
              <button className="btn primary block" onClick={save} disabled={busy || !text.trim()}>
                {busy ? 'Saving…' : 'Publish to all students'}
              </button>
              <button className="btn ghost block" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSettings() {
  const { adminEmail, logout } = useAdmin()
  const [showPwd, setShowPwd] = useState(false)

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Settings</h1>
        </div>
      </div>

      <AnnouncementManager />

      {/* Admin profile */}
      <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
        <h2>Admin profile</h2>
      </div>
      <div className="card flush list">
        <div className="list-item">
          <span className="muted">Studio</span>
          <span className="li-main" style={{ fontSize: 14 }}>{STUDIO_NAME}</span>
        </div>
        <div className="list-item">
          <span className="muted">Admin email</span>
          <span className="li-main" style={{ fontSize: 14 }}>{adminEmail || '—'}</span>
        </div>
        <button className="list-item as-button" onClick={() => setShowPwd((v) => !v)}>
          <span className="muted">Password</span>
          <span className="li-main" style={{ fontSize: 14, color: 'var(--accent-bright)' }}>Change</span>
        </button>
      </div>

      {showPwd && (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted small" style={{ margin: 0 }}>
            The admin login is configured through the server’s environment
            variables (<code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code>). To
            change the password, update <code>ADMIN_PASSWORD</code> in the backend
            deployment (Render → Environment) and redeploy.
          </p>
        </div>
      )}

      {/* Logout */}
      <button className="btn danger block" style={{ marginTop: 20 }} onClick={logout}>
        Log out
      </button>

      <div style={{ height: 28 }} />
    </>
  )
}
