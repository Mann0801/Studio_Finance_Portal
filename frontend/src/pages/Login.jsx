import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginWithPhone, getLastPhone, setLastPhone, toTenDigits } from '../lib/auth'
import { STUDIO_NAME, LOGO_SRC } from '../lib/brand'
import LegalFooter from '../components/LegalFooter'

export default function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [form, setForm] = useState({
    phone: state?.phone || getLastPhone(),
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
      await loginWithPhone(form.phone, form.password)
      setLastPhone(form.phone.replace(/\D/g, ''))
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
        <p className="auth-sub">Log in with your phone number and password.</p>
      </div>

      {notice && <p className="notice" style={{ textAlign: 'center', marginBottom: 14 }}>{notice}</p>}

      <form onSubmit={onSubmit} className="form">
        <label>
          Phone number
          <div className="phone-field">
            <span className="phone-cc">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set('phone')({ target: { value: toTenDigits(e.target.value) } })}
              placeholder="10-digit mobile number"
              autoComplete="tel"
              required
            />
          </div>
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
