import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Surfaced so a missing .env is obvious during development. We still create a
  // client with harmless placeholders so the UI renders — createClient() throws
  // on an empty URL, which would otherwise blank the whole app.
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — auth is disabled until you fill in frontend/.env',
  )
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Auth/signup calls go straight to Supabase (not through our backend), so they
// need the same protection: iOS Safari reuses a keep-alive socket the server has
// already closed and, unlike Chrome, won't retry — surfacing "Load failed". A
// fetch rejection means no request reached the server, so retrying a fresh
// connection is safe. supabase-js lets us swap in the fetch it uses everywhere.
const retryFetch = async (input, init) => {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(600 * attempt) // 0ms, 600ms, 1200ms
    try {
      return await fetch(input, init)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  { global: { fetch: retryFetch } },
)
