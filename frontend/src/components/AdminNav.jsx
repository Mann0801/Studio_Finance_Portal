import { NavLink } from 'react-router-dom'
import { HomeIcon, UsersIcon, PaymentIcon, SettingsIcon } from './Icons'

const TABS = [
  { to: '/admin', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/admin/students', label: 'Students', Icon: UsersIcon },
  { to: '/admin/payments', label: 'Payments', Icon: PaymentIcon },
  { to: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function AdminNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
