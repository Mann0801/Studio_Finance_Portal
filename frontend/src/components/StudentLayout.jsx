import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import AnnouncementBanner from './AnnouncementBanner'
import { DashboardProvider } from '../context/DashboardContext'

/* Shell for all student pages: phone-width column, announcement banner at the
   top, fixed bottom navigation. Dashboard data is loaded once and shared. */
export default function StudentLayout() {
  return (
    <DashboardProvider>
      <div className="app-shell with-nav">
        <div className="page">
          <AnnouncementBanner />
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </DashboardProvider>
  )
}
