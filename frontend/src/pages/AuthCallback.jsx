import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { STUDIO_NAME } from '../lib/brand'

/**
 * Landing page for the email magic link. Supabase parses the session from the
 * URL automatically (detectSessionInUrl). We then either:
 *  - intent=reset  → show a "set new password" form, or
 *  - otherwise     → route new users to profile setup, returning users home.
 */
export default function AuthCallback() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const intent = params.get('intent')
  const navigate = useNavigate()

  const routing = !loading && !!session && intent !== 'reset'

  useEffect(() => {
    if (!routing) return undefined
    let active = true
    ;(async () => {
      try {
        await api('/api/me/profile') // 200 => existing
        if (active) navigate('/', { replace: true })
      } catch {
        if (active) navigate('/profile-setup', { replace: true })
      }
    })()
    return () => {
      active = false
    }
  }, [routing, navigate])

  if (loading) return <Centered text="Verifying your link…" />
  if (!session) {
    return (
      <div className="auth-wrap">
        <div className="auth-brand">
          <img src="/icon.svg" alt="" className="logo" />
          <div className="brand-name">{STUDIO_NAME}</div>
          <h1>Link expired</h1>
          <p className="auth-sub">This sign-in link is invalid or has expired.</p>
        </div>
        <Link to="/login" className="btn primary lg block">Back to login</Link>
      </div>
    )
  }
  if (intent === 'reset') return <ResetForm navigate={navigate} />
  return <Centered text="Signing you in…" />
}

function Centered({ text }) {
  return (
    <div className="center">
      <div className="splash-spinner" style={{ margin: '0 auto 14px' }} />
      <p className="muted">{text}</p>
    </div>
  )
}

function ResetForm({ navigate }) {
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
