import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, setAdminToken, setAdminEmail } from '../../lib/adminApi'
import { STUDIO_NAME, LOGO_SRC } from '../../lib/brand'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await adminApi('/api/admin/login', {
        method: 'POST',
        body: form,
        auth: false,
      })
      setAdminToken(token)
      setAdminEmail(form.email)
      navigate('/admin', { replace: true })
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
        <h1>Admin</h1>
        <p className="auth-sub">Studio management console</p>
      </div>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
