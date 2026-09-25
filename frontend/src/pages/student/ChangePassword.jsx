import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../../lib/auth'
import { ArrowLeftIcon } from '../../components/Icons'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const confirmState = !confirmPassword
    ? ''
    : confirmPassword === newPassword && newPassword
      ? 'match'
      : 'mismatch'

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('At least 8 characters')
      return
    }
    if (confirmPassword !== newPassword) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await changePassword(newPassword)
      navigate(-1)
    } catch (err) {
      setError(err.message || 'Could not update your password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Change password</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="form" style={{ marginTop: 8 }}>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={confirmState === 'match' ? 'valid' : ''}
            autoComplete="new-password"
            placeholder="Re-enter new password"
          />
          {confirmState === 'match' && <span className="field-ok">Passwords match ✓</span>}
          {confirmState === 'mismatch' && <span className="field-hint">Passwords don’t match yet</span>}
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </>
  )
}
