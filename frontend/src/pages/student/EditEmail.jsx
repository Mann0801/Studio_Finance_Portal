import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Only mounted once `student` is loaded, so its initial state is always
// correct without needing an effect to sync it in after the fact.
function EmailForm({ student, onSaved }) {
  const [email, setEmail] = useState(student.email || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (trimmed && !EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      // Sent as-is, including empty — clearing it here brings back the Home
      // banner since the student no longer has one on file.
      await api('/api/me/email', { method: 'PATCH', body: { email: trimmed } })
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save your email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form" style={{ marginTop: 8 }}>
      <label>
        Recovery email
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <span className="field-hint">Used only for password recovery.</span>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary lg block" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

export default function EditEmail() {
  const { data, loading, reload } = useDashboard()
  const navigate = useNavigate()

  async function onSaved() {
    await reload()
    navigate(-1)
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Recovery email</h1>
        </div>
      </div>

      {loading || !data ? <CardSkeleton lines={2} /> : <EmailForm student={data.student} onSaved={onSaved} />}
    </>
  )
}
