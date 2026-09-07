import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '../../lib/adminApi'
import { formatPhoneDisplay } from '../../lib/auth'
import { ArrowLeftIcon, WhatsAppIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

export default function AdminResetPassword() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [tempPassword, setTempPassword] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    adminApi(`/api/admin/students/${id}`)
      .then((data) => setStudent({ name: data.name, phone: data.phone }))
      .catch((e) => setError(e.message))
  }, [id])

  async function resetPassword() {
    setBusy(true)
    setError('')
    try {
      const res = await adminApi(`/api/admin/students/${id}/reset-password`, { method: 'POST' })
      setTempPassword(res.temp_password)
      setConfirm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function copy() {
    navigator.clipboard
      ?.writeText(`Phone: ${formatPhoneDisplay(student.phone)}\nPassword: ${tempPassword}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
  }

  const waLink = () => {
    const msg =
      `Your I'm Possible Fit login was reset.\n` +
      `Phone: ${formatPhoneDisplay(student.phone)}\nNew password: ${tempPassword}\n` +
      `You can change it anytime from your profile in the app.`
    return `https://wa.me/${(student.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Reset password</h1>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!student ? (
        <CardSkeleton lines={2} />
      ) : tempPassword ? (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--accent)' }}>
          <strong>New password</strong>
          <p className="muted small" style={{ marginTop: 4 }}>
            Their old password no longer works. Share this so they can log in — they can change it
            later from their profile.
          </p>
          <div className="card flush list" style={{ marginTop: 10 }}>
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{formatPhoneDisplay(student.phone)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Password</span>
              <span className="li-main" style={{ fontSize: 14 }}>{tempPassword}</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            <a className="btn block wa-cta" href={waLink()} target="_blank" rel="noreferrer">
              <WhatsAppIcon width={18} height={18} /> Send on WhatsApp
            </a>
            <button className="btn ghost block" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy login details'}
            </button>
            <button className="btn ghost block" onClick={() => navigate(-1)}>
              Done
            </button>
          </div>
        </div>
      ) : confirm ? (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--unpaid)' }}>
          <p style={{ marginTop: 0, lineHeight: 1.5 }}>
            Reset <strong>{student.name}</strong>'s password? Their current password will stop
            working and you'll get a new one to share.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn primary block" onClick={resetPassword} disabled={busy}>
              {busy ? 'Resetting…' : 'Yes, reset password'}
            </button>
            <button className="btn ghost block" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ marginTop: 0 }}>
            Generates a new temporary password for <strong>{student.name}</strong> and invalidates
            their current one.
          </p>
          <button className="btn primary block" onClick={() => setConfirm(true)}>
            Reset password
          </button>
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
