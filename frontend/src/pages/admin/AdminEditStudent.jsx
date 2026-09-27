import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { toTenDigits } from '../../lib/auth'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

export default function AdminEditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi(`/api/admin/students/${id}`)
      .then((data) => {
        // Only ever one field on file — split on the first space so a
        // single-word name (what "First Name Only" flags) shows up with an
        // empty last name for the admin to fill in.
        const parts = (data.name || '').trim().split(/\s+/)
        setForm({
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' '),
          // Stored with country code (91…); show just the 10 digits for editing.
          phone: (data.phone || '').replace(/\D/g, '').slice(-10),
        })
      })
      .catch((e) => setError(e.message))
  }, [id])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.first_name.trim()) return setError('Please enter their first name')
    if (!form.last_name.trim()) return setError('Please enter their last name')
    if (form.phone.replace(/\D/g, '').length !== 10) return setError('Phone must be 10 digits')

    setBusy(true)
    try {
      await adminApi(`/api/admin/students/${id}`, {
        method: 'PATCH',
        body: {
          name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          phone: form.phone.replace(/\D/g, ''),
        },
      })
      reloadStats()
      navigate(-1)
    } catch (err) {
      setError(err.message)
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
          <h1>Edit student</h1>
        </div>
      </div>

      {!form ? (
        <CardSkeleton lines={2} />
      ) : (
        <form onSubmit={onSubmit} className="form" style={{ marginTop: 8 }}>
          <label>
            First name
            <input
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label>
            Last name
            <input
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label>
            Phone
            <div className="phone-field">
              <span className="phone-cc">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: toTenDigits(e.target.value) }))}
              />
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="stack" style={{ gap: 10 }}>
            <button type="submit" className="btn primary lg block" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn ghost block" onClick={() => navigate(-1)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
