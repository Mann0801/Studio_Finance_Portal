import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  ClassIcon,
  PaymentIcon,
  SettingsIcon,
  MenuIcon,
  CloseIcon,
} from './Icons'

const TABS = [
  { to: '/admin', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/admin/students', label: 'Students', Icon: UsersIcon },
  { to: '/admin/classes', label: 'Classes', Icon: ClassIcon },
  { to: '/admin/payments', label: 'Payments', Icon: PaymentIcon },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
]

/* Top-corner hamburger menu for the admin console — replaces the bottom bar so
   pages get the full screen height. Opens a right-side drawer of destinations. */
export default function AdminNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="menu-btn" aria-label="Menu" onClick={() => setOpen(true)}>
        <MenuIcon width={24} height={24} />
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
          </nav>
        </div>
      )}
    </>
  )
}
