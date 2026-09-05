// Shared bounds + validation for the "When did you first join the studio?" field
// used on signup. The studio joining date drives fee pro-rata, so it must be a
// real past date: today at the latest, and no more than 2 years ago.

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
  d.setFullYear(d.getFullYear() - 2)
  return localDateStr(d)
})()

/** Returns an error string for an invalid join date, or '' if it's fine. */
export function joinDateError(value) {
  if (!value) return 'Please select when you joined'
  if (value > MAX_JOIN_DATE) return 'That date is in the future'
  if (value < MIN_JOIN_DATE) return 'For dates over 2 years ago, please contact the studio'
  return ''
}

// "1 October 2026" — always the 1st of whatever month it currently is, so the
// existing-member signup hint stays correct every month without editing.
export const FIRST_OF_THIS_MONTH_LABEL = (() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})()

// The signup notice tells existing members to set their join date to the 1st
// of whichever month they sign up in (see FIRST_OF_THIS_MONTH_LABEL above),
// so the "correct" join date for a given account is the 1st of ITS signup
// month, not a fixed date — this lets the admin check work correctly in any
// month, not just the launch month.
export function expectedJoinDate(signedUpAtIso) {
  if (!signedUpAtIso) return null
  const d = new Date(signedUpAtIso)
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1))
}
