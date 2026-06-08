import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/**
 * Call the backend API, attaching the current Supabase access token as a
 * Bearer credential. Throws an Error with the server's detail message on non-2xx.
 */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(data?.detail || `Request failed (${res.status})`)
  }
  return data
}
