import LegalPage from './LegalPage'
import { BUSINESS } from '../../lib/business'

export default function Contact() {
  return (
    <LegalPage title="Contact Us">
      <p>
        We'd love to hear from you. For any questions about your membership, payments,
        classes, or these policies, reach out to <strong>{BUSINESS.name}</strong>:
      </p>

      <div className="legal-contact">
        <div className="lc-row">
          <span className="lc-k">Business</span>
          <span className="lc-v">{BUSINESS.name}</span>
        </div>
        <div className="lc-row">
          <span className="lc-k">Owner</span>
          <span className="lc-v">{BUSINESS.owner}</span>
        </div>
        <div className="lc-row">
          <span className="lc-k">Email</span>
          <span className="lc-v">
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </span>
        </div>
        <div className="lc-row">
          <span className="lc-k">Phone</span>
          <span className="lc-v">
            {BUSINESS.phones.map((p, i) => (
              <span key={p}>
                {i > 0 && ', '}
                <a href={`tel:+91${p}`}>+91 {p}</a>
              </span>
            ))}
          </span>
        </div>
        <div className="lc-row">
          <span className="lc-k">Address</span>
          <span className="lc-v">{BUSINESS.address}</span>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 18 }}>
        We usually respond within 1–2 business days.
      </p>
    </LegalPage>
  )
}
