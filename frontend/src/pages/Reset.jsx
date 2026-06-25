import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STUDIO_NAME } from '../lib/brand'

/**
 * Landing page for the password-reset email link. Supabase parses the recovery
 * session from the URL automatically (detectSessionInUrl), so a valid link
 * gives us a session here and we let the user set a new password.
 */
export default function Reset() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) throw pwErr
      await supabase.auth.signOut()
      navigate('/login', { replace: true, state: { notice: 'Password updated — please log in.' } })
    } catch (err) {
      setError(err.message || 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="center">
        <div className="splash-spinner" style={{ margin: '0 auto 14px' }} />
        <p className="muted">Opening reset link…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="auth-wrap">
        <div className="auth-brand">
          <img src="/icon.svg" alt="" className="logo" />
          <div className="brand-name">{STUDIO_NAME}</div>
          <h1>Link expired</h1>
          <p className="auth-sub">This reset link is invalid or has expired.</p>
        </div>
        <Link to="/forgot-password" className="btn primary lg block">Request a new link</Link>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Set a new password</h1>
      </div>
      <form onSubmit={submit} className="form">
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
