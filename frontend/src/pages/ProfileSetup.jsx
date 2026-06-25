import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { checkUsername, setLastUsername } from '../lib/auth'
import { BATCHES, rupees } from '../lib/batches'
import { STUDIO_NAME } from '../lib/brand'
import { CheckIcon } from '../components/Icons'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

function validate(form, usernameState) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (!form.username.trim()) errors.username = 'Choose a username'
  else if (!USERNAME_RE.test(form.username.trim()))
    errors.username = '3–30 letters, numbers or underscores'
  else if (usernameState === 'taken') errors.username = 'That username is taken'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a batch'
  return errors
}

// Fallback screen: reached only when an authenticated user has no students row
// yet (e.g. signup created the auth account but /api/signup didn't finish). The
// password is already set during signup, so we only collect the profile here.
export default function ProfileSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    username: '',
    phone: '',
    batch: '',
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [usernameState, setUsernameState] = useState('') // '' | 'checking' | 'ok' | 'taken' | 'invalid'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  // Format validity is derived during render; only the async availability
  // result lives in state (set inside the debounce callback, never synchronously).
  const trimmedUsername = form.username.trim()
  const usernameFormatValid = USERNAME_RE.test(trimmedUsername)

  useEffect(() => {
    if (!usernameFormatValid) return undefined
    const t = setTimeout(async () => {
      setUsernameState('checking')
      try {
        const { available } = await checkUsername(trimmedUsername)
        setUsernameState(available ? 'ok' : 'taken')
      } catch {
        setUsernameState('')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [trimmedUsername, usernameFormatValid])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form, usernameState)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      // Create the student profile (idempotent; enforces unique username).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          username: form.username.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
        },
      })
      setLastUsername(form.username.trim())
      navigate('/first-payment', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not complete setup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap page">
      <div className="auth-brand">
        <div className="brand-name">{STUDIO_NAME}</div>
        <h1>Set up your profile</h1>
        <p className="auth-sub">A few details and you’re in.</p>
      </div>

      <form onSubmit={onSubmit} className="form" noValidate>
        <label>
          Full name
          <input value={form.name} onChange={set('name')} className={errors.name ? 'invalid' : ''} autoComplete="name" />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <label>
          Username
          <input
            value={form.username}
            onChange={set('username')}
            className={
              (trimmedUsername && !usernameFormatValid) || usernameState === 'taken' ? 'invalid' : ''
            }
            autoCapitalize="none"
            spellCheck="false"
            placeholder="e.g. priya_yoga"
          />
          {trimmedUsername && !usernameFormatValid && (
            <span className="field-error">3–30 letters, numbers or underscores</span>
          )}
          {usernameFormatValid && usernameState === 'checking' && <span className="field-hint">Checking…</span>}
          {usernameFormatValid && usernameState === 'ok' && <span className="field-ok">✓ Available</span>}
          {usernameFormatValid && usernameState === 'taken' && (
            <span className="field-error">That username is taken</span>
          )}
          {errors.username && !trimmedUsername && <span className="field-error">{errors.username}</span>}
        </label>

        <label>
          Phone
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={(e) => set('phone')(e.target.value.replace(/\D/g, ''))}
            maxLength={10}
            className={errors.phone ? 'invalid' : ''}
            placeholder="10-digit mobile number"
            autoComplete="tel"
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <div>
          <div className="legend" style={{ marginBottom: 10 }}>Choose your batch</div>
          <div className="batch-list">
            {BATCHES.map((b) => (
              <label key={b.id} className={`batch-opt ${form.batch === b.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="batch"
                  value={b.id}
                  checked={form.batch === b.id}
                  onChange={() => set('batch')(b.id)}
                />
                <span className="check">{form.batch === b.id ? <CheckIcon width={13} height={13} /> : ''}</span>
                <span className="b-name">{b.label}</span>
                <span className="b-price">{rupees(b.monthly * 100)}/mo</span>
              </label>
            ))}
          </div>
          {errors.batch && <span className="field-error">{errors.batch}</span>}
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
