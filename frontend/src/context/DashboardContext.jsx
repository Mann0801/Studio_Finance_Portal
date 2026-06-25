import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ensureProfile } from '../lib/profile'

const DashboardContext = createContext(null)

/* Loads /api/me/dashboard once for the student area and shares it across the
   Home / Payments / Profile tabs. `reload()` refreshes after a payment so the
   UI flips to Paid immediately. */
// True when the backend says the profile doesn't exist yet (signup incomplete).
const isMissingProfile = (msg) => /complete signup|profile not found/i.test(msg || '')

export function DashboardProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsProfile, setNeedsProfile] = useState(false)

  const fetchDashboard = useCallback(async () => {
    // If a profile was stashed during signup, make sure it exists first.
    await ensureProfile()
    return api('/api/me/dashboard')
  }, [])

  // Manual refresh (e.g. after a payment) — safe to call from event handlers.
  const reload = useCallback(async () => {
    try {
      const d = await fetchDashboard()
      setData(d)
      setError('')
    } catch (e) {
      if (isMissingProfile(e.message)) setNeedsProfile(true)
      else setError(e.message)
    }
  }, [fetchDashboard])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const d = await fetchDashboard()
        if (active) {
          setData(d)
          setError('')
        }
      } catch (e) {
        if (!active) return
        if (isMissingProfile(e.message)) setNeedsProfile(true)
        else setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchDashboard])

  return (
    <DashboardContext.Provider value={{ data, loading, error, needsProfile, reload }}>
      {children}
    </DashboardContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  return useContext(DashboardContext)
}
