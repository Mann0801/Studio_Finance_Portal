import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BATCHES, rupees } from '../lib/batches'
import { ensureProfile, savePendingProfile } from '../lib/profile'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    batch: 'yoga',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const profile = { name: form.name, phone: form.phone, batch: form.batch }
      const { data, error: signErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: profile },
      })
      if (signErr) throw signErr

      if (data.session) {
        // Email confirmation disabled: we have a session now — create the profile.
        await ensureProfile(profile)
        navigate('/', { replace: true })
      } else {
        // Email confirmation required: finish profile on first login.
        savePendingProfile(profile)
        setNotice('Account created. Please confirm your email, then log in.')
      }
    } catch (err) {
      setError(err.message || 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Join the studio</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Full name
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            minLength={6}
            required
          />
        </label>

        <fieldset className="batches">
          <legend>Choose your batch</legend>
          {BATCHES.map((b) => (
            <label key={b.id} className={`batch ${form.batch === b.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="batch"
                value={b.id}
                checked={form.batch === b.id}
                onChange={set('batch')}
              />
              <span className="batch-name">{b.label}</span>
              <span className="batch-price">{rupees(b.monthly * 100)}/mo</span>
            </label>
          ))}
        </fieldset>

        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
