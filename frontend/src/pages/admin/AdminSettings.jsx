import { useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { STUDIO_NAME } from '../../lib/brand'

export default function AdminSettings() {
  const { adminEmail } = useAdmin()
  const [showPwd, setShowPwd] = useState(false)

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Settings</h1>
        </div>
      </div>

      {/* Admin profile */}
      <div className="section-h" style={{ marginTop: 4, marginBottom: 4 }}>
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

      <div style={{ height: 28 }} />
    </>
  )
}
