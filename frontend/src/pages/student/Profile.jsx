import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../context/DashboardContext'
import { CardSkeleton } from '../../components/Skeleton'
import { FingerprintIcon } from '../../components/Icons'
import {
  enableBiometric,
  disableBiometric,
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
} from '../../lib/webauthn'

export default function Profile() {
  const { session, signOut } = useAuth()
  const { data, loading, error } = useDashboard()

  const [bioSupported, setBioSupported] = useState(false)
  const [bioOn, setBioOn] = useState(isBiometricEnabled())
  const [bioMsg, setBioMsg] = useState('')
  const [bioBusy, setBioBusy] = useState(false)

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBioSupported)
  }, [])

  async function toggleBio() {
    setBioMsg('')
    setBioBusy(true)
    try {
      if (bioOn) {
        disableBiometric()
        setBioOn(false)
        setBioMsg('Biometric unlock turned off.')
      } else {
        await enableBiometric(session?.user?.id || 'student', data?.student?.name || '')
        setBioOn(true)
        setBioMsg('Biometric unlock enabled for this device.')
      }
    } catch {
      setBioMsg('Could not set up biometrics on this device.')
    } finally {
      setBioBusy(false)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Profile</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={3} />}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="stack">
          <div className="card row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 54, height: 54, fontSize: 22 }}>
              {data.student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{data.student.name}</div>
              <div className="muted small">{data.student.batch_label} batch</div>
            </div>
          </div>

          <div className="card flush list">
            <div className="list-item">
              <span className="muted">Email</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.email}</span>
            </div>
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.phone}</span>
            </div>
            <div className="list-item">
              <span className="muted">Joined</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {new Date(data.student.join_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {bioSupported && (
            <div className="card">
              <div className="between">
                <div className="row" style={{ gap: 12 }}>
                  <FingerprintIcon width={26} height={26} style={{ color: 'var(--accent-bright)' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Biometric unlock</div>
                    <div className="muted small">Fingerprint or Face ID on this device</div>
                  </div>
                </div>
                <button
                  className={`btn ${bioOn ? 'ghost' : 'primary'}`}
                  onClick={toggleBio}
                  disabled={bioBusy}
                  style={{ minHeight: 44, padding: '0 16px' }}
                >
                  {bioBusy ? '…' : bioOn ? 'Turn off' : 'Enable'}
                </button>
              </div>
              {bioMsg && <p className="notice" style={{ marginTop: 12 }}>{bioMsg}</p>}
            </div>
          )}

          <button className="btn danger block" onClick={signOut}>
            Log out
          </button>
        </div>
      )}
    </>
  )
}
