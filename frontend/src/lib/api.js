import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** Turn a FastAPI error body into a readable string.
 *  `detail` may be a string, or a list/object of validation errors ({loc,msg,type}). */
function errorMessage(data, status) {
  const d = data?.detail
  if (typeof d === 'string' && d) return d
  if (Array.isArray(d)) {
    const msgs = d
      .map((e) => (typeof e === 'string' ? e : e?.msg))
      .filter(Boolean)
    if (msgs.length) return msgs.join('; ')
  }
  if (d && typeof d === 'object' && d.msg) return d.msg
  return `Request failed (${status})`
}

/**
 * Call the backend API, attaching the current Supabase access token as a
 * Bearer credential. Throws an Error with the server's detail message on non-2xx.
 */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const send = (token) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  let token = null
  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    token = session.access_token
  }

  let res = await send(token)

  // A 401 usually means the access token went stale — force a refresh and retry
  // once, so a long-open session recovers instead of erroring out.
  if (res.status === 401 && auth) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    if (refreshed?.session) {
      res = await send(refreshed.session.access_token)
    }
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON response (e.g. a proxy/error page during a cold start or outage).
    if (!res.ok) throw new Error(`Server error (${res.status}). Please try again in a moment.`)
  }
  if (res.status === 401 && auth) {
    throw new Error('Your session expired — please log in again.')
  }
  if (!res.ok) {
    throw new Error(errorMessage(data, res.status))
  }
  return data
}
