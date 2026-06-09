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

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
