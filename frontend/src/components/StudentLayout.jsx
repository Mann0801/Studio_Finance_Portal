import { Navigate, Outlet } from 'react-router-dom'
import StudentNav from './StudentNav'
import AnnouncementBanner from './AnnouncementBanner'
import { DashboardProvider, useDashboard } from '../context/DashboardContext'

/* Inner shell — redirects to profile setup if the signed-in user hasn't
   completed it yet (e.g. closed the app mid-signup). */
function Shell() {
  const { needsProfile } = useDashboard()
  if (needsProfile) return <Navigate to="/profile-setup" replace />
  return (
    <div className="app-shell with-menu">
      <StudentNav />
      <div className="page">
        <AnnouncementBanner />
        <Outlet />
      </div>
    </div>
  )
}

/* Shell for all student pages: phone-width column, announcement banner at the
   top, fixed bottom navigation. Dashboard data is loaded once and shared. */
export default function StudentLayout() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}
