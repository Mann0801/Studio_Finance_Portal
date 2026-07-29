import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import StatusBadge from '../../components/StatusBadge'
import BatchPicker from '../../components/BatchPicker'
import { WhatsAppIcon, ArrowLeftIcon, EditIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'

const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', opts) : '—'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** Full-page student profile with admin actions (mark paid, remove). */
export default function AdminStudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const { classes } = useClasses()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')

  const load = useCallback(() => {
    adminApi(`/api/admin/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => load(), [load])

  const back = () => navigate('/admin/students')

  function startEdit() {
    setFormError('')
    setForm({
      name: data.name,
      phone: data.phone,
      batch: data.batch,
      batch_slot: data.batch_slot ?? null,
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Please enter their full name')
    if (form.phone.replace(/\D/g, '').length !== 10) return setFormError('Phone must be 10 digits')
    if (hasSlots(classById(classes, form.batch)) && !form.batch_slot)
      return setFormError('Please choose a timing')

    setBusy(true)
    try {
      const updated = await adminApi(`/api/admin/students/${id}`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          batch: form.batch,
          batch_slot: form.batch_slot,
        },
      })
      setData(updated)
      reloadStats()
      setEditing(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function markPaid() {
    setBusy(true)
    try {
      const updated = await adminApi(`/api/admin/students/${id}/mark-paid`, { method: 'POST' })
      setData(updated)
      reloadStats()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await adminApi(`/api/admin/students/${id}`, { method: 'DELETE' })
      reloadStats()
      navigate('/admin/students', { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const paid = data?.status === 'paid'

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={back}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>{editing ? 'Edit student' : 'Student'}</h1>
        </div>
      </div>

      {editing && data ? (
        <form onSubmit={saveEdit} className="form" style={{ marginTop: 8 }}>
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
              maxLength={10}
            />
          </label>
          <BatchPicker
            classes={classes}
            batch={form.batch}
            slot={form.batch_slot}
            onSelect={(batch, slot) => setForm((f) => ({ ...f, batch, batch_slot: slot }))}
          />
          {formError && <p className="error">{formError}</p>}
          <div className="stack" style={{ gap: 10 }}>
            <button type="submit" className="btn primary lg block" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn ghost block"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          <div style={{ height: 28 }} />
        </form>
      ) : !data ? (
        <>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '16px 0 8px' }}>
            <Skeleton height={84} width={84} radius={999} />
            <Skeleton height={22} width="55%" />
            <Skeleton height={14} width="40%" />
          </div>
          <CardSkeleton lines={3} />
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="profile-head">
            <div className="profile-avatar">{data.name.charAt(0).toUpperCase()}</div>
            <h2 className="profile-name">{data.name}</h2>
            <div className="muted">
              {data.batch_label}
              {data.slot_label ? ` · ${data.slot_label}` : ''}
            </div>
            <div style={{ marginTop: 10 }}>
              {data.batch_deleted ? (
                <span className="badge deleted big">Batch Deleted</span>
              ) : (
                <StatusBadge status={data.status} big />
              )}
            </div>
            {data.batch_deleted && (
              <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>
                This class was removed. Tap Edit to reassign them to a class.
              </p>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          {/* Info */}
          <div className="card flush list" style={{ marginTop: 16 }}>
            <a className="list-item link-row" href={`tel:${data.phone}`}>
              <span className="muted">Phone</span>
              <span className="li-main accent">{data.phone}</span>
            </a>
            {data.email && (
              <a className="list-item link-row" href={`mailto:${data.email}`}>
                <span className="muted">Email</span>
                <span className="li-main accent" style={{ fontSize: 14 }}>{data.email}</span>
              </a>
            )}
            <div className="list-item">
              <span className="muted">Member since</span>
              <span className="li-main" style={{ fontSize: 14 }}>{fmtDate(data.join_date)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Days as member</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.days_member} days</span>
            </div>
          </div>

          {/* Payment */}
          <div className="section-h" style={{ marginTop: 20, marginBottom: 8 }}>
            <h2>Payments</h2>
          </div>
          <div className="card">
            <div className="between">
              <div>
                <div className="muted small">{periodLabel(data.period)} {paid ? '' : '· due'}</div>
                <div className="amount" style={{ fontSize: 28 }}>{rupees(data.amount_paise)}</div>
              </div>
              <StatusBadge status={data.status} />
            </div>
            {!paid && data.amount_paise > 0 && (
              <button className="btn primary block" style={{ marginTop: 12 }} onClick={markPaid} disabled={busy}>
                {busy ? 'Marking…' : 'Mark this month paid'}
              </button>
            )}
          </div>

          <div className="card flush list" style={{ marginTop: 12 }}>
            <div className="list-item">
              <span className="muted">Total paid</span>
              <span className="li-main">{rupees(data.total_paid_paise)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Last payment</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {data.last_payment_paise != null
                  ? `${rupees(data.last_payment_paise)} · ${fmtDate(data.last_payment_at, { day: 'numeric', month: 'short' })}`
                  : 'None yet'}
              </span>
            </div>
          </div>

          {/* History */}
          <div className="feed-head" style={{ paddingLeft: 2, marginTop: 12 }}>Payment history</div>
          {data.payments.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="card flush list">
              {data.payments.map((p, i) => (
                <div className="list-item" key={i}>
                  <div className="li-main">
                    <div>{periodLabel(p.period)}</div>
                    <div className="muted small">
                      {p.status === 'paid' ? `${p.method} · ${fmtDate(p.paid_at, { day: 'numeric', month: 'short' })}` : p.status}
                    </div>
                  </div>
                  <span
                    className="li-main"
                    style={{ color: p.status === 'paid' ? 'var(--paid)' : 'var(--muted)' }}
                  >
                    {rupees(p.amount_paise)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="stack" style={{ marginTop: 20, gap: 10 }}>
            <button className="btn ghost block" onClick={startEdit}>
              <EditIcon width={16} height={16} /> Edit details
            </button>
            {data.whatsapp_url && (
              <a className="btn block wa-cta" href={data.whatsapp_url} target="_blank" rel="noreferrer">
                <WhatsAppIcon width={18} height={18} /> Message on WhatsApp
              </a>
            )}
            {!paid && data.amount_paise > 0 && (
              <button className="btn primary block" onClick={markPaid} disabled={busy}>
                {busy ? 'Marking…' : 'Mark as Paid'}
              </button>
            )}

            {confirmRemove ? (
              <div className="card" style={{ borderColor: 'var(--unpaid)' }}>
                <p style={{ marginTop: 0 }}>
                  Remove <strong>{data.name}</strong>? This deletes their account and
                  payment history permanently.
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn danger block" onClick={remove} disabled={busy}>
                    {busy ? 'Removing…' : 'Yes, remove student'}
                  </button>
                  <button className="btn ghost block" onClick={() => setConfirmRemove(false)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn ghost block danger-text" onClick={() => setConfirmRemove(true)}>
                Remove student
              </button>
            )}
          </div>

          <div style={{ height: 28 }} />
        </>
      )}
    </>
  )
}
