import { useEffect, useState } from 'react'
import { api } from './api'
import { rupees } from './batches'

/* Dynamic class catalogue. Classes live in the DB now; the signup + admin pages
   read them live so add/edit/delete show up immediately. Module-cached so the
   list is fetched once per session (call invalidateClasses() after an edit). */
let _cache = null
let _inflight = null

export async function fetchClasses({ force = false } = {}) {
  if (_cache && !force) return _cache
  if (_inflight && !force) return _inflight
  _inflight = api('/api/classes', { auth: false })
    .then((data) => {
      _cache = data
      _inflight = null
      return data
    })
    .catch((e) => {
      _inflight = null
      throw e
    })
  return _inflight
}

export function invalidateClasses() {
  _cache = null
}

/** Fetch the active class list once for a page. */
export function useClasses() {
  const [classes, setClasses] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetchClasses()
      .then((c) => active && setClasses(c))
      .catch((e) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [])
  return { classes, error }
}

// ── Lookups ──────────────────────────────────────────────────────────────────
export const classById = (classes, id) => (classes || []).find((c) => c.id === id)
export const slotsOf = (cls) => cls?.slots || []
export const hasSlots = (cls) => slotsOf(cls).length > 0
export const slotByKey = (cls, key) => slotsOf(cls).find((s) => s.key === key)

// ── Display helpers ──────────────────────────────────────────────────────────
export const FEE_TYPE_LABELS = {
  monthly: 'Monthly',
  session_pack: 'Session pack',
  per_session: 'Per session',
  enquiry: 'Contact for enquiry',
}

const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** "Mon to Fri", "Sat & Sun", or a comma list. */
export function daysLabel(days) {
  const d = (days || []).slice().sort((a, b) => a - b)
  if (!d.length) return ''
  const consecutive = d.every((v, i) => i === 0 || v === d[i - 1] + 1)
  if (d.length >= 3 && consecutive) return `${DAY_ABBR[d[0]]} to ${DAY_ABBR[d[d.length - 1]]}`
  return d.map((x) => DAY_ABBR[x]).join(' & ')
}

export function slotTime(slot) {
  if (!slot) return ''
  if (slot.start && slot.end) return `${slot.start} – ${slot.end}`
  return slot.start || slot.end || ''
}

/** Schedule line for a class card: days + single timing (if no slots). */
export function scheduleLabel(cls) {
  let s = daysLabel(cls.schedule_days)
  if (!hasSlots(cls) && cls.start_time && cls.end_time) {
    const t = `${cls.start_time} – ${cls.end_time}`
    s = s ? `${s} · ${t}` : t
  }
  return s
}

/** Price line for a class card. */
export function priceLabel(cls) {
  const r = rupees(cls.fee_paise)
  switch (cls.fee_type) {
    case 'monthly':
      return `${r}/month`
    case 'session_pack':
      return `${r} · ${cls.sessions_per_month} sessions/mo`
    case 'per_session':
      return `${r}/session`
    case 'enquiry':
      return 'Contact for enquiry'
    default:
      return r
  }
}
