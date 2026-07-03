import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { setLastEmail } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { batchById } from '../lib/batches'
import { STUDIO_NAME } from '../lib/brand'
import BatchPicker from '../components/BatchPicker'

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Please enter your full name'
  if (form.phone.replace(/\D/g, '').length !== 10) errors.phone = 'Enter exactly 10 digits'
  if (!form.batch) errors.batch = 'Please select a batch'
  else if (batchById(form.batch)?.hasSlots && !form.batch_slot)
    errors.batch = 'Please choose a timing for Traditional Yoga'
  return errors
}

// Fallback screen: reached only when an authenticated user has no students row
// yet (e.g. signup created the auth account but /api/signup didn't finish). The
// password is already set during signup, so we only collect the profile here.
export default function ProfileSetup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    batch: '',
    batch_slot: null,
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: value }))
    if (submitted) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setBusy(true)
    try {
      // Create the student profile (idempotent, keyed to the verified user).
      await api('/api/signup', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
          batch_slot: form.batch_slot,
        },
      })
      const { data } = await supabase.auth.getUser()
      if (data?.user?.email) setLastEmail(data.user.email)
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

        <BatchPicker
          batch={form.batch}
          slot={form.batch_slot}
          error={errors.batch}
          onSelect={(batch, slot) => {
            setForm((f) => ({ ...f, batch, batch_slot: slot }))
            if (submitted) setErrors((prev) => ({ ...prev, batch: undefined }))
          }}
        />

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary lg block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
