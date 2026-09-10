import { useState } from 'react'
import { api } from '../lib/api'
import { MailIcon } from './Icons'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Persistent "add a recovery email" nudge for students who signed up before
 * this was collected — stays visible (with a gentle pulse, like the menu
 * button) until they fill it in, since there's no other way for them to get
 * a self-serve password reset without one. */
export default function EmailBanner({ onSaved }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    setBusy(true)
    try {
      await api('/api/me/email', { method: 'PATCH', body: { email: trimmed } })
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save your email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="email-banner" onSubmit={submit}>
      <div className="email-banner-head">
        <span className="email-banner-icon">
          <MailIcon width={18} height={18} />
        </span>
        <span className="email-banner-text">
          <strong>Add a recovery email</strong>
          <span>Used only for password recovery</span>
        </span>
      </div>
      <div className="email-banner-row">
        <input
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
        />
        <button type="submit" disabled={busy || !email.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <span className="email-banner-error">{error}</span>}
    </form>
  )
}
