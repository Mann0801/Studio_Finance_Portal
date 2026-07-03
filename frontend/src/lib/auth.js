import { supabase } from './supabase'

const LAST_EMAIL_KEY = 'lastEmail'

export const getLastEmail = () => localStorage.getItem(LAST_EMAIL_KEY) || ''
export const setLastEmail = (e) => localStorage.setItem(LAST_EMAIL_KEY, e)

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

/**
 * Log in with email + password directly against Supabase. The session is
 * persisted and auto-refreshed by the Supabase client, so the user stays logged
 * in across visits until they explicitly log out.
 */
export async function loginWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw new Error('Invalid email or password')
}

/** Email a password-reset link that lands the user on /reset to set a new password. */
export async function sendResetEmail(email) {
  const redirectTo = new URL('/reset', window.location.origin).toString()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  })
  if (error) throw error
}
