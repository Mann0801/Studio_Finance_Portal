import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ensureProfile } from '../lib/profile'

const DashboardContext = createContext(null)

/* Loads /api/me/dashboard once for the student area and shares it across the
   Home / Payments / Attendance / Profile tabs. `reload()` refreshes after a
   payment so the UI flips to Paid immediately. */
export function DashboardProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDashboard = useCallback(async () => {
    // If a profile was stashed during signup (email-confirmation flow), make
    // sure it exists before we ask for the dashboard.
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
      setError(e.message)
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
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [fetchDashboard])

  return (
    <DashboardContext.Provider value={{ data, loading, error, reload }}>
      {children}
    </DashboardContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  return useContext(DashboardContext)
}
