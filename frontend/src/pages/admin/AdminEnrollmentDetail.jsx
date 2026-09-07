import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { MAX_JOIN_DATE } from '../../lib/joinDate'
import { currentPeriod } from '../../lib/periods'
import { rupees } from '../../lib/batches'
import { useClasses, classById, hasSlots } from '../../lib/classes'
import StatusBadge from '../../components/StatusBadge'
import { WhatsAppIcon, ArrowLeftIcon, EditIcon, CashIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', opts) : '—'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
  return `${date}, ${time}`
}

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** One class's own dues/history/actions, as its own page — reached by tapping
 * a class row on the student's profile. Keeps the profile page short. */
export default function AdminEnrollmentDetail() {
  const { id, batch } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const { classes } = useClasses()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [removePaymentConfirm, setRemovePaymentConfirm] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null)
  const [moveTo, setMoveTo] = useState('')
  const [moveErr, setMoveErr] = useState('')
  const [moving, setMoving] = useState(false)

  const load = useCallback(() => {
    adminApi(`/api/admin/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => load(), [load])

  const en = useMemo(() => data?.enrollments.find((e) => e.batch === batch), [data, batch])
  const cls = classById(classes, batch)

  const back = () => navigate(-1)

  function startEdit() {
    setSlot(en.batch_slot || '')
    setJoinDate(en.join_date)
    setEditErr('')
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    setEditErr('')
    try {
      const updated = await adminApi(`/api/admin/students/${id}/enrollments/${batch}`, {
        method: 'PATCH',
        body: { batch_slot: slot || null, join_date: joinDate },
      })
      setData(updated)
      reloadStats()
      setEditing(false)
    } catch (e) {
      setEditErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const goRecord = (period) => navigate(`/admin/students/${id}/record-cash/${batch}/${period}`)

  async function runPeriodAction(action, period) {
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
  const onWaive = (period) => runPeriodAction('waive', period)
  const onUnwaive = (period) => runPeriodAction('unwaive', period)
  const onRemovePayment = (period) => runPeriodAction('remove-payment', period)

  async function movePayment(fromPeriod, toPeriod) {
    setMoving(true)
    setMoveErr('')
    try {
      const updated = await adminApi(`/api/admin/students/${id}/move-payment`, {
        method: 'POST',
        body: { batch, from_period: fromPeriod, to_period: toPeriod },
      })
      setData(updated)
      reloadStats()
      setMoveTarget(null)
      setMoveTo('')
    } catch (e) {
      setMoveErr(e.message)
    } finally {
      setMoving(false)
    }
  }

  async function removeEnrollment() {
    setBusy(true)
    try {
      await adminApi(`/api/admin/students/${id}/enrollments/${batch}`, { method: 'DELETE' })
      reloadStats()
      navigate(-1)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const canRemove = data ? data.enrollments.length > 1 : false
  const paid = en?.status === 'paid'
  const waived = en?.status === 'waived'

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={back}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>{en?.batch_label || 'Class'}</h1>
          {en?.slot_label && <div className="hello" style={{ marginTop: 2 }}>{en.slot_label}</div>}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!data ? (
        <CardSkeleton lines={4} />
      ) : !en ? (
        <div className="card empty" style={{ marginTop: 12 }}>This class isn't on their account.</div>
      ) : (
        <>
          <div className="between" style={{ marginTop: 4 }}>
            <div>
              {en.batch_deleted && <span className="badge deleted">Batch Deleted</span>}
            </div>
            <StatusBadge status={en.status} />
          </div>

          {editing ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="stack" style={{ gap: 10 }}>
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
                {editErr && <p className="error">{editErr}</p>}
                <div className="stack" style={{ gap: 8 }}>
                  <button type="button" className="btn primary block" onClick={saveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="btn ghost block" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card flush list" style={{ marginTop: 12 }}>
                <div className="list-item">
                  <span className="muted">Joined this class</span>
                  <span className="li-main" style={{ fontSize: 14 }}>{fmtDate(en.join_date)}</span>
                </div>
                <div className="list-item">
                  <span className="muted">Days as member</span>
                  <span className="li-main" style={{ fontSize: 14 }}>{en.days_member} days</span>
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <div className="muted small">
                  {periodLabel(en.period)} {waived ? '· waived' : paid ? '' : en.paid_paise > 0 ? '· balance' : '· due'}
                </div>
                {waived ? (
                  <p className="muted" style={{ margin: '4px 0 0' }}>This month's fee was forgiven.</p>
                ) : (
                  <>
                    <div className="amount" style={{ fontSize: 26 }}>{rupees(en.amount_paise)}</div>
                    {!paid && en.paid_paise > 0 && (
                      <div className="part-paid">{rupees(en.paid_paise)} already paid</div>
                    )}
                  </>
                )}
                {waived ? (
                  <button
                    className="btn ghost block"
                    style={{ marginTop: 10 }}
                    onClick={() => onUnwaive(en.period)}
                    disabled={busy}
                  >
                    Un-waive this month
                  </button>
                ) : (
                  !paid &&
                  en.amount_paise > 0 && (
                    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                      <button className="btn primary block" onClick={() => goRecord(en.period)} disabled={busy}>
                        Record payment
                      </button>
                      <button className="btn ghost block" onClick={() => onWaive(en.period)} disabled={busy}>
                        Waive this month
                      </button>
                    </div>
                  )
                )}
              </div>

              {en.outstanding.length > 0 && (
                <>
                  <div className="muted small" style={{ marginTop: 14 }}>Earlier months due</div>
                  <div className="card flush" style={{ marginTop: 6 }}>
                    <div className="data-row head">
                      <span>Month</span>
                      <span>Balance</span>
                      <span></span>
                    </div>
                    {en.outstanding.map((p) => (
                      <div className="data-row static" key={p.period}>
                        <span className="data-name">{periodLabel(p.period)}</span>
                        <span className="data-sub data-sub-2line">
                          <span>
                            {p.is_prorata ? 'Pro-rated · ' : ''}
                            {rupees(p.amount_paise)}
                          </span>
                          {p.paid_paise > 0 && (
                            <span className="data-sub-timing">{rupees(p.paid_paise)} paid</span>
                          )}
                        </span>
                        <div className="data-end">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn primary sm" onClick={() => goRecord(p.period)} disabled={busy}>
                              Record
                            </button>
                            <button className="btn ghost sm" onClick={() => onWaive(p.period)} disabled={busy}>
                              Waive
                            </button>
                          </div>
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
                      ? `${rupees(en.last_payment_paise)} · ${fmtDateTime(en.last_payment_at)}`
                      : 'None yet'}
                  </span>
                </div>
              </div>

              {en.payments.length > 0 && (
                <>
                  <div className="muted small" style={{ marginTop: 14 }}>Payment history</div>
                  <div className="card flush" style={{ marginTop: 6 }}>
                    <div className="data-row head">
                      <span>Month</span>
                      <span>Paid via</span>
                      <span style={{ textAlign: 'right' }}>Amount</span>
                    </div>
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
                                onRemovePayment(p.period)
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
                      ) : moveTarget === p.period ? (
                        <div className="list-item" key={i} style={{ display: 'block' }}>
                          <p className="muted small" style={{ margin: '0 0 8px' }}>
                            Move the {periodLabel(p.period)} payment ({rupees(p.paid_paise)}) to which month?
                          </p>
                          <input
                            type="month"
                            value={moveTo}
                            onChange={(e) => setMoveTo(e.target.value)}
                            min={en.join_date.slice(0, 7)}
                            max={currentPeriod()}
                          />
                          {moveErr && <p className="error">{moveErr}</p>}
                          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                            <button
                              className="btn primary sm"
                              disabled={!moveTo || moveTo === p.period || moving}
                              onClick={() => movePayment(p.period, moveTo)}
                            >
                              {moving ? 'Moving…' : 'Move'}
                            </button>
                            <button
                              className="btn ghost sm"
                              onClick={() => {
                                setMoveTarget(null)
                                setMoveErr('')
                              }}
                              disabled={moving}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="data-row static" key={i}>
                          <span className="data-name">{periodLabel(p.period)}</span>
                          <span className="data-sub data-sub-2line">
                            <span>
                              {p.method !== 'Online' && <CashIcon width={12} height={12} className="cash-ico" />}
                              {p.method}
                            </span>
                            {p.paid_at && <span className="data-sub-timing">{fmtDateTime(p.paid_at)}</span>}
                          </span>
                          <div className="data-end">
                            <div
                              style={{
                                color: p.status === 'paid' ? 'var(--paid)' : 'var(--warn)',
                                fontWeight: 700,
                                fontSize: 16,
                              }}
                            >
                              {rupees(p.paid_paise)}
                            </div>
                            {p.status !== 'paid' && (
                              <div style={{ color: 'var(--warn)', fontWeight: 700, marginTop: 2 }}>partial</div>
                            )}
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn ghost sm"
                                onClick={() => {
                                  setMoveTarget(p.period)
                                  setMoveTo('')
                                  setMoveErr('')
                                }}
                              >
                                Move
                              </button>
                              <button
                                type="button"
                                className="btn ghost sm danger-text"
                                onClick={() => setRemovePaymentConfirm(p.period)}
                              >
                                Remove
                              </button>
                            </div>
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
                <button type="button" className="btn ghost block" onClick={startEdit}>
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
                        <button className="btn danger block" onClick={removeEnrollment} disabled={busy}>
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
        </>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
