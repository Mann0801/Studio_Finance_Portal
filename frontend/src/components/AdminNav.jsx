import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { LOGO_SRC, STUDIO_NAME } from '../lib/brand'
import ConfirmDialog from './ConfirmDialog'
import {
  HomeIcon,
  UsersIcon,
  ClassIcon,
  PaymentIcon,
  MegaphoneIcon,
  SettingsIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
  InfoIcon,
  MailIcon,
  ProfileIcon,
} from './Icons'

const TABS = [
  { to: '/admin', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/admin/students', label: 'Students', Icon: UsersIcon },
  { to: '/admin/classes', label: 'Classes', Icon: ClassIcon },
  { to: '/admin/payments', label: 'Payments', Icon: PaymentIcon },
  { to: '/admin/join-dates', label: 'Join Date Check', Icon: InfoIcon },
  { to: '/admin/missing-emails', label: 'Recovery Email', Icon: MailIcon },
  { to: '/admin/first-name-only', label: 'First Name Only', Icon: ProfileIcon },
  { to: '/admin/announcements', label: 'Announcements', Icon: MegaphoneIcon },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
]

/* Admin navigation: a top-corner hamburger + drawer on phone (so pages get
   the full screen height), and a persistent left sidebar on a wider screen
   (laptop/desktop) that takes advantage of the extra width instead of
   staying a cramped phone-width column. Same TABS/logout for both — CSS
   media queries decide which one is actually visible. */
export default function AdminNav() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { logout } = useAdmin()

  return (
    <>
      {/* ── Phone: hamburger + drawer ── */}
      <button className="menu-btn" aria-label="Menu" onClick={() => setOpen(true)}>
        <MenuIcon width={22} height={22} />
        <span className="menu-btn-label">Menu</span>
      </button>

      {open && (
        <div className="menu-overlay" onClick={() => setOpen(false)}>
          <nav className="menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="menu-head">
              <span className="menu-title">Menu</span>
              <button className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            {TABS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
              >
                <Icon width={22} height={22} />
                {label}
              </NavLink>
            ))}
            <button
              className="menu-item danger"
              onClick={() => {
                setOpen(false)
                setConfirm(true)
              }}
            >
              <LogoutIcon width={22} height={22} />
              Log out
            </button>
          </nav>
        </div>
      )}

      {/* ── Laptop/desktop: persistent sidebar ── */}
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <img src={LOGO_SRC} alt="" />
          <span>{STUDIO_NAME}</span>
        </div>
        <nav className="app-sidebar-nav">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              <Icon width={20} height={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-spacer" />
        <button className="menu-item danger" onClick={() => setConfirm(true)}>
          <LogoutIcon width={20} height={20} />
          Log out
        </button>
      </aside>

      <ConfirmDialog
        open={confirm}
        title="Log out?"
        message="You'll need to sign in to the admin console again."
        confirmLabel="Log out"
        danger
        onConfirm={logout}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
