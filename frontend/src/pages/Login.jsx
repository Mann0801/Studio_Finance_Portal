import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginWithEmail, getLastEmail, setLastEmail } from '../lib/auth'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import LegalFooter from '../components/LegalFooter'

export default function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [form, setForm] = useState({
    email: state?.email || getLastEmail(),
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
      await loginWithEmail(form.email, form.password)
      setLastEmail(form.email.trim().toLowerCase())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src={LOGO_SRC} alt="I'm Possible Fit" className="logo" />
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in with your email and password.</p>
      </div>

      {notice && <p className="notice" style={{ textAlign: 'center', marginBottom: 14 }}>{notice}</p>}

      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
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
      <p className="auth-foot" style={{ marginTop: 6 }}>
        <Link to="/plans">Browse our classes &amp; pricing →</Link>
      </p>

      <LegalFooter />
    </div>
  )
}
