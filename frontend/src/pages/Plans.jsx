import { Link } from 'react-router-dom'
import { STUDIO_NAME } from '../lib/brand'
import { useClasses, priceLabel, scheduleLabel, slotsOf, slotTime } from '../lib/classes'
import { BUSINESS } from '../lib/business'
import LegalFooter from '../components/LegalFooter'

/**
 * Public, no-login page describing the classes and membership prices offered.
 * Lets first-time visitors (and payment-gateway reviewers) see the products/
 * services before signing up.
 */
export default function Plans() {
  const { classes } = useClasses()
  return (
    <div className="legal-wrap">
      <div className="legal-top">
        <Link to="/login" className="legal-brand">{STUDIO_NAME}</Link>
      </div>

      <h1 className="legal-h1">Classes &amp; Membership Plans</h1>
      <p className="legal-updated">
        {STUDIO_NAME} — a fitness &amp; yoga studio in {BUSINESS.city}
      </p>

      <div className="legal-body" style={{ marginBottom: 20 }}>
        <p>
          We offer group fitness and yoga classes for all ages. Pick a batch that suits you,
          create an account, and pay your membership securely online. Monthly fees are shown
          below and are billed per month unless noted otherwise.
        </p>
      </div>

      <div className="plans-grid">
        {(classes || []).map((c) => (
          <div className="plan-card" key={c.id}>
            <div className="plan-name">{c.name}</div>
            {scheduleLabel(c) && <div className="plan-sched">{scheduleLabel(c)}</div>}
            <div className="plan-price">{priceLabel(c)}</div>

            {slotsOf(c).length > 0 && (
              <ul className="plan-slots">
                {slotsOf(c).map((s) => (
                  <li key={s.key}>{s.name} · {slotTime(s)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="plans-cta">
        <Link to="/signup" className="btn primary lg block">Create an account &amp; join</Link>
        <Link to="/login" className="btn ghost block">I already have an account</Link>
      </div>

      <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 16 }}>
        Questions about a class? <Link to="/contact-us">Contact us</Link> — we're at {BUSINESS.address}.
      </p>

      <LegalFooter />
    </div>
  )
}
