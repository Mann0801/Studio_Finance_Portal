const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'adminToken'
const EMAIL_KEY = 'adminEmail'

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY)
export const setAdminToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearAdminToken = () => localStorage.removeItem(TOKEN_KEY)

export const getAdminEmail = () => localStorage.getItem(EMAIL_KEY) || ''
export const setAdminEmail = (e) => localStorage.setItem(EMAIL_KEY, e)
export const clearAdminEmail = () => localStorage.removeItem(EMAIL_KEY)

/** Call the backend admin API with the stored admin JWT. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function adminApi(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getAdminToken()
    if (!token) throw new Error('Not authenticated')
    headers.Authorization = `Bearer ${token}`
  }

  // Retry network-level failures on a fresh connection — the free-tier backend
  // cold-starting, or iOS Safari reusing a keep-alive socket Render already closed
  // ("Load failed"). No request reached the server, so a retry is safe.
  let res, lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(600 * attempt)
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      lastErr = null
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (lastErr) {
    const err = new Error('Network error — please check your connection and try again.')
    err.network = true
    throw err
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON body (e.g. a proxy/error page during a Render cold start).
    if (!res.ok) throw new Error(`Server error (${res.status}). Please try again in a moment.`)
  }

  if (res.status === 401) {
    // A rejected token means the stored session is stale — clear it and say so.
    // A 401 on the login call itself is just bad credentials; show the real reason.
    if (auth) {
      clearAdminToken()
      throw new Error('Session expired — please log in again')
    }
    throw new Error(data?.detail || 'Invalid admin credentials')
  }

  if (!res.ok) throw new Error(data?.detail || `Request failed (${res.status})`)
  return data
}
