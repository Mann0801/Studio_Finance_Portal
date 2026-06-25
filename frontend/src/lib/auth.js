import { supabase } from './supabase'
import { api } from './api'

const LAST_USER_KEY = 'lastUsername'

export const getLastUsername = () => localStorage.getItem(LAST_USER_KEY) || ''
export const setLastUsername = (u) => localStorage.setItem(LAST_USER_KEY, u)

/**
 * Create the auth account with an email + password. With "Confirm email" off in
 * Supabase this returns a live session immediately — no email is sent. Throws a
 * friendly error if the email is already registered.
 */
export async function signUpWithPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error('That email is already registered — try logging in instead.')
    }
    throw error
  }
  // Supabase obfuscates duplicate signups by returning a user with no identities.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('That email is already registered — try logging in instead.')
  }
  if (!data?.session) {
    throw new Error('Could not start a session. Please try again.')
  }
}

/** Email a password-reset link that lands the user on /reset to set a new password. */
export async function sendResetEmail(email) {
  const redirectTo = new URL('/reset', window.location.origin).toString()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  })
  if (error) throw error
}

/** Live username availability check (profile setup). */
export async function checkUsername(username) {
  return api(`/api/auth/username-available?username=${encodeURIComponent(username)}`, {
    auth: false,
  })
}

/** Log in by username + password: backend resolves + runs the password grant,
    returns session tokens, which we hand to the Supabase client. */
export async function loginWithUsername(username, password) {
  const { access_token, refresh_token } = await api('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { username: username.trim(), password },
  })
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
}
