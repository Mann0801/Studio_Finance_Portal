import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isBiometricEnabled, unlockBiometric, biometricUserName } from '../lib/webauthn'
import { FingerprintIcon } from './Icons'

const UNLOCK_FLAG = 'bio:unlocked' // per-tab session

/* If the student enabled biometric unlock on this device, require a successful
   fingerprint/Face ID assertion before showing protected content. Falls back to
   email/password (sign out -> login) if biometrics fail. */
export default function BiometricGate({ children }) {
  const { signOut } = useAuth()
  const need = isBiometricEnabled() && sessionStorage.getItem(UNLOCK_FLAG) !== '1'
  const [locked, setLocked] = useState(need)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const attempt = async () => {
    setError('')
    setBusy(true)
    try {
      const ok = await unlockBiometric()
      if (ok) {
        sessionStorage.setItem(UNLOCK_FLAG, '1')
        setLocked(false)
      } else {
        setError('Could not verify. Try again or use your password.')
      }
    } catch {
      setError('Biometric unlock failed. Try again or use your password.')
    } finally {
      setBusy(false)
    }
  }

  // Prompt automatically on first mount when locked (deferred so we don't call
  // setState synchronously inside the effect body).
  useEffect(() => {
    if (!locked) return
    const t = setTimeout(attempt, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!locked) return children

  const name = biometricUserName()
  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="success-check" style={{ background: 'var(--accent-soft)', color: 'var(--accent-bright)' }}>
          <FingerprintIcon width={48} height={48} />
        </div>
        <h1>{name ? `Welcome back, ${name.split(' ')[0]}` : 'Welcome back'}</h1>
        <p className="auth-sub">Unlock with your fingerprint or Face ID</p>
      </div>
      {error && <p className="error" style={{ textAlign: 'center', marginBottom: 12 }}>{error}</p>}
      <div className="stack">
        <button className="btn primary lg block" onClick={attempt} disabled={busy}>
          {busy ? 'Verifying…' : 'Unlock'}
        </button>
        <button
          className="btn ghost block"
          onClick={() => {
            sessionStorage.removeItem(UNLOCK_FLAG)
            signOut()
          }}
        >
          Use email & password
        </button>
      </div>
    </div>
  )
}
