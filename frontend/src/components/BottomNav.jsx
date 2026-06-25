import { NavLink } from 'react-router-dom'
import { HomeIcon, PaymentIcon, ProfileIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/payments', label: 'Payments', Icon: PaymentIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

export default function BottomNav() {
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
