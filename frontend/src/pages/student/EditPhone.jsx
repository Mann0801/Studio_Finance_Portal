import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { toTenDigits } from '../../lib/auth'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

// Only mounted once `student` is loaded, so its initial state is always
// correct without needing an effect to sync it in after the fact.
function PhoneForm({ student, onSaved }) {
  const [phone, setPhone] = useState((student.phone || '').replace(/\D/g, '').slice(-10))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter exactly 10 digits')
      return
    }
    setBusy(true)
    try {
      // The backend updates name + phone together — send the name unchanged.
      await api('/api/me/profile', {
        method: 'PATCH',
        body: { name: student.name, phone: phone.replace(/\D/g, '') },
      })
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save your phone number')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form" style={{ marginTop: 8 }}>
      <label>
        Phone number
        <div className="phone-field">
          <span className="phone-cc">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(toTenDigits(e.target.value))}
            placeholder="10-digit mobile number"
            autoComplete="tel"
          />
        </div>
      </label>
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
      <button type="submit" className="btn primary lg block" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

export default function EditPhone() {
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
          <h1>Edit phone number</h1>
        </div>
      </div>

      {loading || !data ? <CardSkeleton lines={2} /> : <PhoneForm student={data.student} onSaved={onSaved} />}
    </>
  )
}
