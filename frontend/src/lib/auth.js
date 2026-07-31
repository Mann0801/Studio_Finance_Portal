import { supabase } from './supabase'

const LAST_PHONE_KEY = 'lastPhone'

export const getLastPhone = () => localStorage.getItem(LAST_PHONE_KEY) || ''
export const setLastPhone = (p) => localStorage.setItem(LAST_PHONE_KEY, p)

// Students log in with their PHONE + password. Supabase auth is email-based, so
// the phone maps to a synthetic internal email the student never sees. Signup,
// login and the admin "add student" flow must all derive it the same way (last
// 10 digits) so the same phone always resolves to the same account.
const PHONE_DOMAIN = 'phone.iampossiblefit.com'
export const phoneToEmail = (phone) => `${phone.replace(/\D/g, '').slice(-10)}@${PHONE_DOMAIN}`

/** Reduce any phone input to the 10-digit national number. Autofill often injects
 *  the country code ("+91 98765 43210"), so we strip non-digits and keep the LAST
 *  10 — dropping a leading 91/0 — instead of truncating the front. */
export const toTenDigits = (raw) => {
  const digits = String(raw).replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

/**
 * Create the account with phone + password. With "Confirm email" off in Supabase
 * this returns a live session immediately — no email is sent. Throws a friendly
 * error if the phone is already registered.
 */
export async function signUpWithPhone(phone, password) {
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password,
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error('That phone number is already registered — try logging in instead.')
    }
    throw error
  }
  // Supabase obfuscates duplicate signups by returning a user with no identities.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('That phone number is already registered — try logging in instead.')
  }
  if (!data?.session) {
    throw new Error('Could not start a session. Please try again.')
  }
}

/** Log in with phone + password. The session is persisted + auto-refreshed. */
export async function loginWithPhone(phone, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  })
  if (error) throw new Error('Invalid phone number or password')
}

/** Change the signed-in user's password (self-serve). No email needed — the user
 *  is already authenticated. Supabase rejects a password identical to the current
 *  one; we surface that as a friendly message. */
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    if (/should be different|same.*password|password.*same/i.test(error.message)) {
      throw new Error('New password cannot be the same as your old password')
    }
    throw new Error(error.message || 'Could not update your password')
  }
}
