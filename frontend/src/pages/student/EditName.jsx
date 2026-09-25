import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { api } from '../../lib/api'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

// Only mounted once `student` is loaded, so its initial state is always
// correct without needing an effect to sync it in after the fact.
function NameForm({ student, onSaved }) {
  const [name, setName] = useState(student.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Please enter your full name')
      return
    }
    setBusy(true)
    try {
      // The backend updates name + phone together — send the phone unchanged.
      await api('/api/me/profile', {
        method: 'PATCH',
        body: { name: name.trim(), phone: student.phone.replace(/\D/g, '') },
      })
      await onSaved()
    } catch (err) {
      setError(err.message || 'Could not save your name')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form" style={{ marginTop: 8 }}>
      <label>
        Full name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary lg block" disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

export default function EditName() {
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
          <h1>Edit name</h1>
        </div>
      </div>

      {loading || !data ? <CardSkeleton lines={2} /> : <NameForm student={data.student} onSaved={onSaved} />}
    </>
  )
}
