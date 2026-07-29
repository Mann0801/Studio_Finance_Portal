import { BUSINESS } from '../../lib/business'
import { WhatsAppIcon, PhoneIcon } from '../../components/Icons'

const waLink = (phone) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`

export default function StudioContact() {
  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Contact</h1>
        </div>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        <div className="card">
          <div className="card-title">{BUSINESS.name}</div>
          <p className="muted" style={{ marginTop: 8, lineHeight: 1.55 }}>{BUSINESS.address}</p>
        </div>

        <div className="card flush list">
          {BUSINESS.phones.map((ph) => (
            <a key={ph} className="list-item link-row" href={`tel:+91${ph}`}>
              <span className="muted">Call</span>
              <span className="li-main accent">{ph}</span>
            </a>
          ))}
          {BUSINESS.email && (
            <a className="list-item link-row" href={`mailto:${BUSINESS.email}`}>
              <span className="muted">Email</span>
              <span className="li-main accent" style={{ fontSize: 14 }}>{BUSINESS.email}</span>
            </a>
          )}
        </div>

        <a className="btn block wa-cta" href={waLink(BUSINESS.phones[0])} target="_blank" rel="noreferrer">
          <WhatsAppIcon width={18} height={18} /> Message on WhatsApp
        </a>
        <a className="btn primary block" href={`tel:+91${BUSINESS.phones[0]}`}>
          <PhoneIcon width={18} height={18} /> Call the studio
        </a>
      </div>
      <div style={{ height: 28 }} />
    </>
  )
}
