import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ensureProfile } from '../lib/profile'
import { FingerprintIcon } from '../components/Icons'
import {
  enableBiometric,
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
  unlockBiometric,
} from '../lib/webauthn'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [bioAvailable, setBioAvailable] = useState(false)
  const [offerBio, setOfferBio] = useState(false) // post-login enable prompt
  const [session, setSession] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBioAvailable)
  }, [])

  function finish() {
    sessionStorage.setItem('bio:unlocked', '1')
    navigate('/', { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword(form)
      if (signErr) throw signErr
      await ensureProfile()
      // Offer biometric setup once, if the device supports it and it's not on yet.
      if (bioAvailable && !isBiometricEnabled()) {
        setSession(data.session)
        setOfferBio(true)
      } else {
        finish()
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function quickUnlock() {
    setError('')
    try {
      const ok = await unlockBiometric()
      if (ok) finish()
      else setError('Biometric unlock failed — use your password.')
    } catch {
      setError('Biometric unlock failed — use your password.')
    }
  }

  async function enableNow() {
    try {
      await enableBiometric(session?.user?.id || 'student', session?.user?.email || '')
    } catch {
      /* user declined / unsupported — proceed regardless */
    }
    finish()
  }

  // Post-login: offer to enable biometric unlock.
  if (offerBio) {
    return (
      <div className="auth-wrap">
        <div className="auth-brand">
          <div
            className="success-check"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}
          >
            <FingerprintIcon width={48} height={48} />
          </div>
          <h1>Faster next time?</h1>
          <p className="auth-sub">
            Use your fingerprint or Face ID to unlock the app instead of typing your password.
          </p>
        </div>
        <div className="stack">
          <button className="btn primary lg block" onClick={enableNow}>
            Enable biometric unlock
          </button>
          <button className="btn ghost block" onClick={finish}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <img src="/icon.svg" alt="" className="logo" />
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to your studio account.</p>
      </div>

      {bioAvailable && isBiometricEnabled() && (
        <button className="btn ghost block" style={{ marginBottom: 18 }} onClick={quickUnlock}>
          <FingerprintIcon width={20} height={20} /> Unlock with biometrics
        </button>
      )}

      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
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
    </div>
  )
}
