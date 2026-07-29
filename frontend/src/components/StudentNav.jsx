import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './ConfirmDialog'
import {
  HomeIcon,
  PaymentIcon,
  PhoneIcon,
  SettingsIcon,
  MegaphoneIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
} from './Icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/payments', label: 'Payments', Icon: PaymentIcon },
  { to: '/announcements', label: 'Announcements', Icon: MegaphoneIcon },
  { to: '/contact', label: 'Contact', Icon: PhoneIcon },
  { to: '/profile', label: 'Settings', Icon: SettingsIcon },
]

/* Top-corner hamburger menu for the student app — replaces the bottom bar so
   pages get the full screen height. Opens a right-side drawer of destinations. */
export default function StudentNav() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const { signOut } = useAuth()

  return (
    <>
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

      <ConfirmDialog
        open={confirm}
        title="Log out?"
        message="You'll need to sign in with your phone and password again."
        confirmLabel="Log out"
        danger
        onConfirm={signOut}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
