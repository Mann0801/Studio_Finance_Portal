import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, clearAdminToken, clearAdminEmail, getAdminEmail } from '../lib/adminApi'

const AdminContext = createContext(null)

/**
 * Shared admin state for the dashboard pages: stats are fetched once and shared
 * across Home/Students/Payments. `guard` logs out on an expired session.
 */
export function AdminProvider({ children }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const logout = useCallback(() => {
    clearAdminToken()
    clearAdminEmail()
    navigate('/admin/login', { replace: true })
  }, [navigate])

  const guard = useCallback(
    (e) => {
      setError(e.message)
      if (/log in|expired/i.test(e.message)) logout()
    },
    [logout],
  )

  const reloadStats = useCallback(() => {
    adminApi('/api/admin/stats').then(setStats).catch(guard)
  }, [guard])

  useEffect(() => {
    reloadStats()
  }, [reloadStats])

  return (
    <AdminContext.Provider
      value={{ stats, reloadStats, error, logout, guard, adminEmail: getAdminEmail() }}
    >
      {children}
    </AdminContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  return useContext(AdminContext)
}
