import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginWithUsername, getLastUsername, setLastUsername } from '../lib/auth'
import { STUDIO_NAME } from '../lib/brand'

export default function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [form, setForm] = useState({
    username: state?.username || getLastUsername(),
    password: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const notice = state?.notice || ''

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await loginWithUsername(form.username, form.password)
      setLastUsername(form.username.trim())
      // A freshly created account goes to first payment; returning users home.
      navigate(state?.newAccount ? '/first-payment' : '/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in with your username and password.</p>
      </div>

      {notice && <p className="notice" style={{ textAlign: 'center', marginBottom: 14 }}>{notice}</p>}

      <form onSubmit={onSubmit} className="form">
        <label>
          Username
          <input
            value={form.username}
            onChange={set('username')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <Link to="/forgot-password" className="link-btn" style={{ alignSelf: 'center' }}>
          Forgot password?
        </Link>
      </form>

      <p className="auth-foot">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  )
}
