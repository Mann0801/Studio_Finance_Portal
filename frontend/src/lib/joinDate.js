// Shared bounds + validation for the "When did you first join the studio?" field
// used on signup. The studio joining date drives fee pro-rata, so it must be a
// real recent date: today at the latest, and no more than 30 days ago (students
// register within a couple of days of joining, so 30 days is a generous window).

// Local YYYY-MM-DD (not UTC, so it stays correct near midnight in IST).
function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const MAX_JOIN_DATE = localDateStr(new Date())
export const MIN_JOIN_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return localDateStr(d)
})()

/** Returns an error string for an invalid join date, or '' if it's fine. */
export function joinDateError(value) {
  if (!value) return 'Please select when you joined'
  if (value > MAX_JOIN_DATE) return 'That date is in the future'
  if (value < MIN_JOIN_DATE) return 'For dates over 30 days ago, please contact the studio'
  return ''
}
