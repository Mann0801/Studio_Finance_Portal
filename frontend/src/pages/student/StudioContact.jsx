import { BUSINESS } from '../../lib/business'
import { formatPhoneDisplay, phoneToTelHref } from '../../lib/auth'
import { WhatsAppIcon, PhoneIcon, InstagramIcon, YouTubeIcon } from '../../components/Icons'

const waLink = (phone) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`

const MAP_QUERY = encodeURIComponent(
  `${BUSINESS.name}, Vinayaka Layout, Dodda Nekkundi Extension, Doddanekkundi, Bengaluru, Karnataka 560037`,
)
const MAP_EMBED = `https://www.google.com/maps?q=${MAP_QUERY}&output=embed`
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`

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
          <p className="muted" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5 }}>
            {BUSINESS.address}
          </p>
          <div className="map-embed" style={{ marginTop: 12 }}>
            <iframe
              title="Studio location"
              src={MAP_EMBED}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a className="btn ghost block" style={{ marginTop: 10 }} href={MAP_LINK} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        </div>

        {BUSINESS.email && (
          <div className="card flush list">
            <a className="list-item link-row" href={`mailto:${BUSINESS.email}`}>
              <span className="muted">Email</span>
              <span className="li-main accent" style={{ fontSize: 14 }}>{BUSINESS.email}</span>
            </a>
          </div>
        )}

        <a className="btn block contact-cta wa-cta" href={waLink(BUSINESS.phones[0])} target="_blank" rel="noreferrer">
          <WhatsAppIcon width={18} height={18} /> Message on WhatsApp
        </a>
        {BUSINESS.instagram && (
          <a className="btn block contact-cta ig-cta" href={BUSINESS.instagram} target="_blank" rel="noreferrer">
            <InstagramIcon width={18} height={18} /> Follow on Instagram
          </a>
        )}
        {BUSINESS.youtube && (
          <a className="btn block contact-cta yt-cta" href={BUSINESS.youtube} target="_blank" rel="noreferrer">
            <YouTubeIcon width={18} height={18} /> Subscribe on YouTube
          </a>
        )}
        {BUSINESS.phones.map((ph) => (
          <a key={ph} className="btn block contact-cta call-cta" href={phoneToTelHref(ph)}>
            <PhoneIcon width={18} height={18} /> Call {formatPhoneDisplay(ph)}
          </a>
        ))}
      </div>
      <div style={{ height: 28 }} />
    </>
  )
}
