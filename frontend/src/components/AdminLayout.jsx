import { Outlet } from 'react-router-dom'
import AdminNav from './AdminNav'
import { AdminProvider } from '../context/AdminContext'

/* Shell for the admin console: phone-width column + fixed bottom navigation.
   Shared stats are loaded once via AdminProvider. */
export default function AdminLayout() {
  return (
    <AdminProvider>
      <div className="app-shell with-nav">
        <div className="page">
          <Outlet />
        </div>
        <AdminNav />
      </div>
    </AdminProvider>
  )
}
