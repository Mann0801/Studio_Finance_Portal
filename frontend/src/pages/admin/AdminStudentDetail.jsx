import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { toTenDigits } from '../../lib/auth'
import { MAX_JOIN_DATE } from '../../lib/joinDate'
import { rupees } from '../../lib/batches'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import StatusBadge from '../../components/StatusBadge'
import BatchPicker from '../../components/BatchPicker'
import { WhatsAppIcon, ArrowLeftIcon, EditIcon, CashIcon, PlusIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'

const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', opts) : '—'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** One class's own dues/history/actions — a student in two classes gets two of
 * these, entirely independent of each other. */
function EnrollmentCard({
  en,
  classes,
  busy,
  onRecordCash,
  onEdit,
  onRemove,
  canRemove,
  onWaive,
  onUnwaive,
  onRemovePayment,
}) {
  const cls = classById(classes, en.batch)
  const paid = en.status === 'paid'
  const waived = en.status === 'waived'
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState(en.batch_slot || '')
  const [joinDate, setJoinDate] = useState(en.join_date)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [removePaymentConfirm, setRemovePaymentConfirm] = useState(null) // period being confirmed
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function saveEdit() {
    setSaving(true)
    setErr('')
    try {
      await onEdit(en.batch, { batch_slot: slot || null, join_date: joinDate })
      setEditing(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="between">
        <div>
          <strong>{en.batch_label}</strong>
          {en.slot_label && <div className="muted small">{en.slot_label}</div>}
          {en.batch_deleted && (
            <span className="badge deleted" style={{ marginTop: 4, display: 'inline-block' }}>
              Batch Deleted
            </span>
          )}
        </div>
        <StatusBadge status={en.status} />
      </div>

      {editing ? (
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          {hasSlots(cls) && (
            <label>
              Timing
              <select value={slot} onChange={(e) => setSlot(e.target.value)}>
                <option value="">Choose a timing</option>
                {cls.slots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name} · {s.start}–{s.end}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Joined this class
            <input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              max={MAX_JOIN_DATE}
            />
            <span className="field-hint">
              Changing this re-calculates pro-rata for all unpaid months in this class. Paid
              months stay as recorded.
            </span>
          </label>
          {err && <p className="error">{err}</p>}
          <div className="stack" style={{ gap: 8 }}>
            <button type="button" className="btn primary block" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn ghost block" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card flush list" style={{ marginTop: 10 }}>
            <div className="list-item">
              <span className="muted">Joined this class</span>
              <span className="li-main" style={{ fontSize: 14 }}>{fmtDate(en.join_date)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Days as member</span>
              <span className="li-main" style={{ fontSize: 14 }}>{en.days_member} days</span>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted small">
              {periodLabel(en.period)} {waived ? '· waived' : paid ? '' : en.paid_paise > 0 ? '· balance' : '· due'}
            </div>
            {waived ? (
              <p className="muted" style={{ margin: '4px 0 0' }}>This month's fee was forgiven.</p>
            ) : (
              <>
                <div className="amount" style={{ fontSize: 26 }}>{rupees(en.amount_paise)}</div>
                {!paid && en.paid_paise > 0 && (
                  <div className="part-paid">{rupees(en.paid_paise)} already paid in cash</div>
                )}
              </>
            )}
          </div>
          {waived ? (
            <button
              className="btn ghost block"
              style={{ marginTop: 10 }}
              onClick={() => onUnwaive(en.batch, en.period)}
              disabled={busy}
            >
              Un-waive this month
            </button>
          ) : (
            !paid &&
            en.amount_paise > 0 && (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn primary block" onClick={() => onRecordCash(en.batch, en.period)} disabled={busy}>
                  Record cash payment
                </button>
                <button className="btn ghost block" onClick={() => onWaive(en.batch, en.period)} disabled={busy}>
                  Waive this month
                </button>
              </div>
            )
          )}

          {en.outstanding.length > 0 && (
            <>
              <div className="muted small" style={{ marginTop: 14 }}>Earlier months due</div>
              <div className="card flush list" style={{ marginTop: 6 }}>
                {en.outstanding.map((p) => (
                  <div className="list-item" key={p.period}>
                    <div>
                      <div className="li-main">{periodLabel(p.period)}</div>
                      <div className="muted small">
                        {p.is_prorata ? 'Pro-rated · ' : ''}
                        {rupees(p.amount_paise)} balance
                        {p.paid_paise > 0 ? ` · ${rupees(p.paid_paise)} paid` : ''}
                      </div>
                    </div>
                    <div className="s-right" style={{ gap: 6 }}>
                      <button className="btn primary sm" onClick={() => onRecordCash(en.batch, p.period)} disabled={busy}>
                        Record
                      </button>
                      <button className="btn ghost sm" onClick={() => onWaive(en.batch, p.period)} disabled={busy}>
                        Waive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="card flush list" style={{ marginTop: 12 }}>
            <div className="list-item">
              <span className="muted">Total paid</span>
              <span className="li-main">{rupees(en.total_paid_paise)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Last payment</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {en.last_payment_paise != null
                  ? `${rupees(en.last_payment_paise)} · ${fmtDate(en.last_payment_at, { day: 'numeric', month: 'short' })}`
                  : 'None yet'}
              </span>
            </div>
          </div>

          {en.payments.length > 0 && (
            <>
              <div className="muted small" style={{ marginTop: 14 }}>Payment history</div>
              <div className="card flush list" style={{ marginTop: 6 }}>
                {en.payments.map((p, i) =>
                  removePaymentConfirm === p.period ? (
                    <div className="list-item" key={i} style={{ display: 'block' }}>
                      <p className="muted small" style={{ margin: '0 0 8px' }}>
                        Remove the {periodLabel(p.period)} payment ({rupees(p.paid_paise)})? The month
                        goes back to unpaid.
                      </p>
                      <div className="stack" style={{ gap: 8 }}>
                        <button
                          className="btn danger sm"
                          onClick={() => {
                            onRemovePayment(en.batch, p.period)
                            setRemovePaymentConfirm(null)
                          }}
                          disabled={busy}
                        >
                          Yes, remove it
                        </button>
                        <button className="btn ghost sm" onClick={() => setRemovePaymentConfirm(null)} disabled={busy}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="list-item" key={i}>
                      <div className="li-main">
                        <div>{periodLabel(p.period)}</div>
                        <div className="muted small">
                          {p.method === 'Cash' && <CashIcon width={12} height={12} className="cash-ico" />}
                          {p.method}
                          {p.paid_at ? ` · ${fmtDate(p.paid_at, { day: 'numeric', month: 'short' })}` : ''}
                          {p.status !== 'paid' ? ' · partial' : ''}
                        </div>
                      </div>
                      <div className="s-right" style={{ alignItems: 'flex-end', gap: 4 }}>
                        <span
                          className="li-main"
                          style={{ color: p.status === 'paid' ? 'var(--paid)' : 'var(--warn)' }}
                        >
                          {rupees(p.paid_paise)}
                        </span>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setRemovePaymentConfirm(p.period)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}

          <div className="stack" style={{ marginTop: 12, gap: 8 }}>
            {en.whatsapp_url && (
              <a className="btn block wa-cta" href={en.whatsapp_url} target="_blank" rel="noreferrer">
                <WhatsAppIcon width={16} height={16} /> Message on WhatsApp
              </a>
            )}
            <button type="button" className="btn ghost block" onClick={() => setEditing(true)}>
              <EditIcon width={14} height={14} /> Edit timing / join date
            </button>
            {canRemove &&
              (removeConfirm ? (
                <div className="card" style={{ borderColor: 'var(--unpaid)' }}>
                  <p style={{ marginTop: 0 }}>
                    Remove {en.batch_label}? Their payment history for this class is kept, it just
                    stops showing here.
                  </p>
                  <div className="stack" style={{ gap: 8 }}>
                    <button className="btn danger block" onClick={() => onRemove(en.batch)} disabled={busy}>
                      {busy ? 'Removing…' : 'Yes, remove this class'}
                    </button>
                    <button className="btn ghost block" onClick={() => setRemoveConfirm(false)} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn ghost block danger-text" onClick={() => setRemoveConfirm(true)}>
                  Remove this class
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
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
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetPass, setResetPass] = useState(null)
  const [resetCopied, setResetCopied] = useState(false)
  const [addingClass, setAddingClass] = useState(false)
  const [addForm, setAddForm] = useState({ batch: '', batch_slot: null, join_date: '' })
  const [addError, setAddError] = useState('')

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
      // Stored with country code (91…); show just the 10 digits for editing.
      phone: (data.phone || '').replace(/\D/g, '').slice(-10),
    })
    setEditing(true)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) return setFormError('Please enter their full name')
    if (form.phone.replace(/\D/g, '').length !== 10) return setFormError('Phone must be 10 digits')

    setBusy(true)
    try {
      const updated = await adminApi(`/api/admin/students/${id}`, {
        method: 'PATCH',
        body: { name: form.name.trim(), phone: form.phone.replace(/\D/g, '') },
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

  // Open the full-page cash recorder for one class's month.
  const goRecord = (batch, period) => navigate(`/admin/students/${id}/record-cash/${batch}/${period}`)

  async function editEnrollment(batch, body) {
    const updated = await adminApi(`/api/admin/students/${id}/enrollments/${batch}`, {
      method: 'PATCH',
      body,
    })
    setData(updated)
    reloadStats()
  }

  async function removeEnrollment(batch) {
    setBusy(true)
    try {
      const updated = await adminApi(`/api/admin/students/${id}/enrollments/${batch}`, {
        method: 'DELETE',
      })
      setData(updated)
      reloadStats()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function runPeriodAction(action, batch, period) {
    setBusy(true)
    setError('')
    try {
      const updated = await adminApi(`/api/admin/students/${id}/${action}`, {
        method: 'POST',
        body: { batch, period },
      })
      setData(updated)
      reloadStats()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const waiveEnrollment = (batch, period) => runPeriodAction('waive', batch, period)
  const unwaiveEnrollment = (batch, period) => runPeriodAction('unwaive', batch, period)
  const removePayment = (batch, period) => runPeriodAction('remove-payment', batch, period)

  const enrolledIds = useMemo(() => new Set((data?.enrollments ?? []).map((e) => e.batch)), [data])
  const availableClasses = useMemo(
    () => (classes ?? []).filter((c) => !enrolledIds.has(c.id)),
    [classes, enrolledIds],
  )

  async function addEnrollment() {
    setAddError('')
    if (!addForm.batch) return setAddError('Please select a class')
    if (hasSlots(classById(classes, addForm.batch)) && !addForm.batch_slot)
      return setAddError('Please choose a timing')
    setBusy(true)
    try {
      const updated = await adminApi(`/api/admin/students/${id}/enrollments`, {
        method: 'POST',
        body: { batch: addForm.batch, batch_slot: addForm.batch_slot, join_date: addForm.join_date || null },
      })
      setData(updated)
      reloadStats()
      setAddingClass(false)
      setAddForm({ batch: '', batch_slot: null, join_date: '' })
    } catch (e) {
      setAddError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setBusy(true)
    setError('')
    try {
      const res = await adminApi(`/api/admin/students/${id}/reset-password`, { method: 'POST' })
      setResetPass(res.temp_password)
      setResetConfirm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function copyReset() {
    navigator.clipboard?.writeText(`Phone: ${data.phone}\nPassword: ${resetPass}`).then(() => {
      setResetCopied(true)
      setTimeout(() => setResetCopied(false), 1500)
    })
  }

  const waResetLink = () => {
    const msg =
      `Your I'm Possible Fit login was reset.\n` +
      `Phone: ${data.phone}\nNew password: ${resetPass}\n` +
      `You can change it anytime from your profile in the app.`
    return `https://wa.me/${(data.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
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
              {data.enrollments.map((e) => e.batch_label).join(', ') || 'No classes'}
            </div>
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
            {data.signed_up_at && (
              <div className="list-item">
                <span className="muted">App Signup Date</span>
                <span className="li-main" style={{ fontSize: 14 }}>{fmtDate(data.signed_up_at)}</span>
              </div>
            )}
            <div className="list-item">
              <span className="muted">Total paid (all classes)</span>
              <span className="li-main">{rupees(data.total_paid_paise)}</span>
            </div>
          </div>

          {/* Classes — each an independent payment thread */}
          <div className="section-h" style={{ marginTop: 20, marginBottom: 0 }}>
            <h2>Classes</h2>
          </div>
          {data.enrollments.map((en) => (
            <EnrollmentCard
              key={en.batch}
              en={en}
              classes={classes}
              busy={busy}
              onRecordCash={goRecord}
              onEdit={editEnrollment}
              onRemove={removeEnrollment}
              canRemove={data.enrollments.length > 1}
              onWaive={waiveEnrollment}
              onUnwaive={unwaiveEnrollment}
              onRemovePayment={removePayment}
            />
          ))}

          {addingClass ? (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Add a class</strong>
              <div className="form" style={{ marginTop: 10 }}>
                <BatchPicker
                  classes={availableClasses}
                  batch={addForm.batch}
                  slot={addForm.batch_slot}
                  onSelect={(batch, slot) => setAddForm((f) => ({ ...f, batch, batch_slot: slot }))}
                />
                <label>
                  Join date <span className="muted small">(optional — defaults to today)</span>
                  <input
                    type="date"
                    value={addForm.join_date}
                    onChange={(e) => setAddForm((f) => ({ ...f, join_date: e.target.value }))}
                    max={MAX_JOIN_DATE}
                  />
                </label>
                {addError && <p className="error">{addError}</p>}
                <button type="button" className="btn primary block" onClick={addEnrollment} disabled={busy}>
                  {busy ? 'Adding…' : 'Add class'}
                </button>
                <button
                  type="button"
                  className="btn ghost block"
                  onClick={() => setAddingClass(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : availableClasses.length > 0 ? (
            <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setAddingClass(true)}>
              <PlusIcon width={16} height={16} /> Add a class
            </button>
          ) : null}

          {/* Actions */}
          <div className="stack" style={{ marginTop: 20, gap: 10 }}>
            <button className="btn ghost block" onClick={startEdit}>
              <EditIcon width={16} height={16} /> Edit name / phone
            </button>

            {/* Reset password — generates a new temp password to share */}
            {resetPass ? (
              <div className="card" style={{ borderColor: 'var(--accent)' }}>
                <strong>New password</strong>
                <p className="muted small" style={{ marginTop: 4 }}>
                  Their old password no longer works. Share this so they can log in — they can
                  change it later from their profile.
                </p>
                <div className="card flush list" style={{ marginTop: 10 }}>
                  <div className="list-item">
                    <span className="muted">Phone</span>
                    <span className="li-main" style={{ fontSize: 14 }}>{data.phone}</span>
                  </div>
                  <div className="list-item">
                    <span className="muted">Password</span>
                    <span className="li-main" style={{ fontSize: 14 }}>{resetPass}</span>
                  </div>
                </div>
                <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                  <a className="btn block wa-cta" href={waResetLink()} target="_blank" rel="noreferrer">
                    <WhatsAppIcon width={18} height={18} /> Send on WhatsApp
                  </a>
                  <button className="btn ghost block" onClick={copyReset}>
                    {resetCopied ? 'Copied ✓' : 'Copy login details'}
                  </button>
                  <button className="btn ghost block" onClick={() => setResetPass(null)}>
                    Done
                  </button>
                </div>
              </div>
            ) : resetConfirm ? (
              <div className="card" style={{ borderColor: 'var(--unpaid)' }}>
                <p style={{ marginTop: 0, lineHeight: 1.5 }}>
                  Reset <strong>{data.name}</strong>'s password? Their current password will stop
                  working and you'll get a new one to share.
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn primary block" onClick={resetPassword} disabled={busy}>
                    {busy ? 'Resetting…' : 'Yes, reset password'}
                  </button>
                  <button className="btn ghost block" onClick={() => setResetConfirm(false)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn ghost block" onClick={() => setResetConfirm(true)}>
                Reset password
              </button>
            )}

            {confirmRemove ? (
              <div className="card" style={{ borderColor: 'var(--unpaid)' }}>
                <p style={{ marginTop: 0 }}>
                  Remove <strong>{data.name}</strong>? This deletes their account and
                  payment history permanently, across every class.
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
