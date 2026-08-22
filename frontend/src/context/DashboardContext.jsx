import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { ensureProfile } from '../lib/profile'

const DashboardContext = createContext(null)
const ACTIVE_CLASS_KEY = 'activeClassId'

/* Loads /api/me/dashboard once for the student area and shares it across the
   Home / Payments / Profile tabs. `reload()` refreshes after a payment so the
   UI flips to Paid immediately.

   A student can be enrolled in more than one class — `data.enrollments` is a
   list, one entry per class, each with its own dues/history. `activeClassId`
   tracks which one is currently shown (persisted so it survives a refresh);
   `activeEnrollment` is that entry, defaulting to the first when nothing (or
   an since-removed class) is selected. */
// True when the backend says the profile doesn't exist yet (signup incomplete).
const isMissingProfile = (msg) => /complete signup|profile not found/i.test(msg || '')

export function DashboardProvider({ children }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsProfile, setNeedsProfile] = useState(false)
  const [activeClassId, setActiveClassIdState] = useState(
    () => localStorage.getItem(ACTIVE_CLASS_KEY) || null,
  )

  const setActiveClassId = useCallback((id) => {
    setActiveClassIdState(id)
    if (id) localStorage.setItem(ACTIVE_CLASS_KEY, id)
  }, [])

  const fetchDashboard = useCallback(async () => {
    // If a profile was stashed during signup, make sure it exists first.
    await ensureProfile()
    return api('/api/me/dashboard')
  }, [])

  // Keep the active tab valid: keep it if it still exists, otherwise default
  // to the first enrollment (e.g. right after signup, or if the admin removed
  // the previously-selected class).
  const applyData = useCallback((d) => {
    setData(d)
    setError('')
    const ids = (d?.enrollments || []).map((e) => e.batch)
    setActiveClassIdState((prev) => (prev && ids.includes(prev) ? prev : ids[0] || null))
  }, [])

  // Manual refresh (e.g. after a payment) — safe to call from event handlers.
  const reload = useCallback(async () => {
    try {
      const d = await fetchDashboard()
      applyData(d)
    } catch (e) {
      if (isMissingProfile(e.message)) setNeedsProfile(true)
      else setError(e.message)
    }
  }, [fetchDashboard, applyData])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const d = await fetchDashboard()
        if (active) applyData(d)
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
  }, [fetchDashboard, applyData])

  const activeEnrollment = useMemo(() => {
    const list = data?.enrollments || []
    return list.find((e) => e.batch === activeClassId) || list[0] || null
  }, [data, activeClassId])

  return (
    <DashboardContext.Provider
      value={{
        data,
        loading,
        error,
        needsProfile,
        reload,
        activeClassId: activeEnrollment?.batch ?? null,
        setActiveClassId,
        activeEnrollment,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  return useContext(DashboardContext)
}
