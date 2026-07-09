import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refunds' },
  { to: '/contact', label: 'Contact' },
]

/** Compact policy links shown at the bottom of public pages. */
export default function LegalFooter() {
  return (
    <footer className="legal-links">
      {LINKS.map((l, i) => (
        <span key={l.to}>
          {i > 0 && <span className="sep">·</span>}
          <Link to={l.to}>{l.label}</Link>
        </span>
      ))}
    </footer>
  )
}
