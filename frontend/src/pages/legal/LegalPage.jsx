import { Link } from 'react-router-dom'
import { STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'

const LINKS = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refunds' },
  { to: '/contact', label: 'Contact' },
]

/** Shared shell for the public policy pages (Terms, Privacy, Refund, Contact). */
export default function LegalPage({ title, children }) {
  return (
    <div className="legal-wrap">
      <div className="legal-top">
        <Link to="/login" className="legal-brand">{STUDIO_NAME}</Link>
      </div>

      <h1 className="legal-h1">{title}</h1>
      <p className="legal-updated">Last updated {BUSINESS.updated}</p>

      <div className="legal-body">{children}</div>

      <nav className="legal-nav">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>{l.label}</Link>
        ))}
      </nav>
    </div>
  )
}
