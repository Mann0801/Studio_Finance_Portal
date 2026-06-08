import { api } from './api'

const PENDING_KEY = 'pendingProfile'

export function savePendingProfile(profile) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(profile))
}

/**
 * Ensure the authenticated user has a students row. If a pending profile was
 * stashed at signup (e.g. email confirmation was required), create it now.
 * Safe to call repeatedly — the backend /api/signup is idempotent.
 */
export async function ensureProfile(profile) {
  const stored = profile ?? JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
  if (!stored) return
  await api('/api/signup', { method: 'POST', body: stored })
  localStorage.removeItem(PENDING_KEY)
}
