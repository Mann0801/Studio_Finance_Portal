import { supabase } from './supabase'
import { api } from './api'

const LAST_USER_KEY = 'lastUsername'

export const getLastUsername = () => localStorage.getItem(LAST_USER_KEY) || ''
export const setLastUsername = (u) => localStorage.setItem(LAST_USER_KEY, u)

/**
 * Email the user a magic sign-in link. They tap it and land on /auth/callback,
 * where we establish the session and route them. `createUser` is false for the
 * password-reset flow (don't create accounts for unknown emails). `intent`
 * ("reset") is echoed back in the callback URL so we know what to do.
 */
export async function sendMagicLink(email, { createUser = true, intent } = {}) {
  const redirect = new URL('/auth/callback', window.location.origin)
  if (intent) redirect.searchParams.set('intent', intent)
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: createUser, emailRedirectTo: redirect.toString() },
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
