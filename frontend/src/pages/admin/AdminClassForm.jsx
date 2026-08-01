import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { useClasses, invalidateClasses, slotsOf } from '../../lib/classes'
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

const DAYS = [
  { d: 0, label: 'Mon' },
  { d: 1, label: 'Tue' },
  { d: 2, label: 'Wed' },
  { d: 3, label: 'Thu' },
  { d: 4, label: 'Fri' },
  { d: 5, label: 'Sat' },
  { d: 6, label: 'Sun' },
]

const FEE_TYPES = [
  { id: 'monthly', label: 'Monthly', hint: 'Fixed fee per month' },
  { id: 'session_pack', label: 'Session based', hint: 'Fee for N sessions/month' },
  { id: 'per_session', label: 'Per session', hint: 'Fee per single session' },
  { id: 'enquiry', label: 'Contact for enquiry', hint: 'No online payment' },
]

const uid = () => `s${Math.random().toString(36).slice(2, 9)}`

const emptyForm = () => ({
  name: '',
  fee_type: 'monthly',
  fee_rupees: '',
  sessions_per_month: '',
  schedule_days: [],
  has_slots: false,
  start_time: '',
  end_time: '',
  slots: [],
  description: '',
})

const formFromClass = (c) => ({
  name: c.name,
  fee_type: c.fee_type,
  fee_rupees: c.fee_paise ? String(c.fee_paise / 100) : '',
  sessions_per_month: c.sessions_per_month ? String(c.sessions_per_month) : '',
  schedule_days: c.schedule_days || [],
  has_slots: slotsOf(c).length > 0,
  start_time: c.start_time || '',
  end_time: c.end_time || '',
  slots: slotsOf(c).map((s) => ({
    _uid: uid(),
    key: s.key,
    name: s.name,
    start: s.start || '',
    end: s.end || '',
  })),
  description: c.description || '',
})

const feeLabel = (t) =>
  t === 'monthly' ? 'Monthly fee (₹)' : t === 'session_pack' ? 'Pack price (₹)' : 'Price per session (₹)'

// Wrapper: resolves the class for edit mode, then mounts the form with a fresh
// initial value (keyed) so state initializes from props without a setState-in-effect.
export default function AdminClassForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { classes } = useClasses()

  let body
  if (!id) {
    body = <ClassForm id={null} initial={emptyForm()} />
  } else if (!classes) {
    body = <CardSkeleton lines={4} />
  } else {
    const cls = classes.find((c) => c.id === id)
    body = cls ? (
      <ClassForm key={id} id={id} initial={formFromClass(cls)} />
    ) : (
      <div className="card empty">Class not found.</div>
    )
  }

  return (
    <>
      <div className="topbar with-back">
        <button
          className="back-btn"
          aria-label="Back"
          onClick={() => navigate(id ? `/admin/classes/${id}` : '/admin/classes')}
        >
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>{id ? 'Edit class' : 'New class'}</h1>
        </div>
      </div>
      {body}
    </>
  )
}

function ClassForm({ id, initial }) {
  const navigate = useNavigate()
  const { reloadStats, guard } = useAdmin()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const patch = (p) => setForm((f) => ({ ...f, ...p }))
  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      schedule_days: f.schedule_days.includes(d)
        ? f.schedule_days.filter((x) => x !== d)
        : [...f.schedule_days, d],
    }))
  const addSlot = () =>
    setForm((f) => {
      const k = uid()
      return { ...f, slots: [...f.slots, { _uid: k, key: k, name: '', start: '', end: '' }] }
    })
  const updateSlot = (u, p) =>
    setForm((f) => ({ ...f, slots: f.slots.map((s) => (s._uid === u ? { ...s, ...p } : s)) }))
  const removeSlot = (u) => setForm((f) => ({ ...f, slots: f.slots.filter((s) => s._uid !== u) }))

  function validate(f) {
    if (!f.name.trim()) return 'Please enter a class name'
    if (f.fee_type !== 'enquiry' && !(Number(f.fee_rupees) > 0)) return 'Please enter a valid fee'
    if (f.fee_type === 'session_pack' && !(Number(f.sessions_per_month) > 0))
      return 'Please enter sessions per month'
    if (f.has_slots) {
      if (!f.slots.length) return 'Add a timing slot, or turn off multiple slots'
      if (f.slots.some((s) => !s.name.trim())) return 'Give each timing slot a name'
    }
    return ''
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const err = validate(form)
    if (err) return setError(err)

    const body = {
      name: form.name.trim(),
      fee_type: form.fee_type,
      fee_paise: form.fee_type === 'enquiry' ? 0 : Math.round(Number(form.fee_rupees) * 100),
      sessions_per_month: form.fee_type === 'session_pack' ? Number(form.sessions_per_month) : null,
      schedule_days: form.schedule_days,
      slots: form.has_slots
        ? form.slots.map((s) => ({
            key: s.key,
            name: s.name.trim(),
            start: s.start || null,
            end: s.end || null,
          }))
        : [],
      start_time: !form.has_slots ? form.start_time || null : null,
      end_time: !form.has_slots ? form.end_time || null : null,
      description: form.description.trim() || null,
    }

    setBusy(true)
    try {
      if (id) await adminApi(`/api/admin/classes/${id}`, { method: 'PATCH', body })
      else await adminApi('/api/admin/classes', { method: 'POST', body })
      invalidateClasses()
      reloadStats()
      navigate(id ? `/admin/classes/${id}` : '/admin/classes')
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="form" noValidate style={{ marginTop: 4 }}>
      <label>
        Class name
        <input
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Power Yoga"
        />
      </label>

      <div>
        <div className="legend" style={{ marginBottom: 8 }}>Fee type</div>
        <div className="fee-types">
          {FEE_TYPES.map((ft) => (
            <button
              type="button"
              key={ft.id}
              className={`fee-type ${form.fee_type === ft.id ? 'active' : ''}`}
              onClick={() => patch({ fee_type: ft.id })}
            >
              <span className="ft-label">{ft.label}</span>
              <span className="ft-hint">{ft.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {form.fee_type !== 'enquiry' && (
        <label>
          {feeLabel(form.fee_type)}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.fee_rupees}
            onChange={(e) => patch({ fee_rupees: e.target.value })}
            placeholder="e.g. 2000"
          />
        </label>
      )}

      {form.fee_type === 'session_pack' && (
        <label>
          Sessions per month
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={form.sessions_per_month}
            onChange={(e) => patch({ sessions_per_month: e.target.value })}
            placeholder="e.g. 8"
          />
        </label>
      )}

      <div>
        <div className="legend" style={{ marginBottom: 8 }}>Schedule days</div>
        <div className="day-chips">
          {DAYS.map((d) => (
            <button
              type="button"
              key={d.d}
              className={`day-chip ${form.schedule_days.includes(d.d) ? 'active' : ''}`}
              onClick={() => toggleDay(d.d)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="between" style={{ marginTop: 2 }}>
        <span className="legend">Multiple timing slots?</span>
        <div className="seg toggle-seg">
          <button
            type="button"
            className={`seg-opt ${!form.has_slots ? 'active' : ''}`}
            onClick={() => patch({ has_slots: false })}
          >
            No
          </button>
          <button
            type="button"
            className={`seg-opt ${form.has_slots ? 'active' : ''}`}
            onClick={() => patch({ has_slots: true })}
          >
            Yes
          </button>
        </div>
      </div>

      {!form.has_slots ? (
        <div className="time-row">
          <label>
            Start time
            <input
              value={form.start_time}
              onChange={(e) => patch({ start_time: e.target.value })}
              placeholder="6:00 AM"
            />
          </label>
          <label>
            End time
            <input
              value={form.end_time}
              onChange={(e) => patch({ end_time: e.target.value })}
              placeholder="7:00 AM"
            />
          </label>
        </div>
      ) : (
        <div className="slots-edit">
          {form.slots.map((s, i) => (
            <div className="slot-edit" key={s._uid}>
              <div className="between" style={{ gap: 8 }}>
                <input
                  className="slot-name-in"
                  value={s.name}
                  onChange={(e) => updateSlot(s._uid, { name: e.target.value })}
                  placeholder={`Batch ${i + 1}`}
                />
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="Remove slot"
                  onClick={() => removeSlot(s._uid)}
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
              <div className="time-row">
                <input
                  value={s.start}
                  onChange={(e) => updateSlot(s._uid, { start: e.target.value })}
                  placeholder="6:30 AM"
                />
                <input
                  value={s.end}
                  onChange={(e) => updateSlot(s._uid, { end: e.target.value })}
                  placeholder="7:30 AM"
                />
              </div>
            </div>
          ))}
          <button type="button" className="btn ghost block" onClick={addSlot}>
            <PlusIcon width={16} height={16} /> Add timing slot
          </button>
        </div>
      )}

      <label>
        Description <span className="muted small">(optional)</span>
        <textarea
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          placeholder="Anything students should know"
        />
      </label>

      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn primary lg block" disabled={busy}>
        {busy ? 'Saving…' : 'Save class'}
      </button>
      <div style={{ height: 28 }} />
    </form>
  )
}
