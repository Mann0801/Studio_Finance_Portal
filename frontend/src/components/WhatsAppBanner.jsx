import { whatsappGroupLink, markWhatsappJoined } from '../lib/whatsapp'
import { WhatsAppIcon } from './Icons'

// Non-blocking floating reminder near the bottom of the home screen. Tapping it
// opens the class's WhatsApp group and records the join (so it clears for good).
// Renders nothing for classes without a group.
export default function WhatsAppBanner({ batch, onJoined }) {
  const link = whatsappGroupLink(batch)
  if (!link) return null

  const join = () => {
    markWhatsappJoined()
    onJoined()
  }

  return (
    <a
      className="wa-banner"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={join}
    >
      <span className="wa-banner-icon">
        <WhatsAppIcon width={22} height={22} />
      </span>
      <span className="wa-banner-text">
        <strong>Join our WhatsApp group</strong>
        <span>Class updates, reminders &amp; announcements</span>
      </span>
      <span className="wa-banner-cta">Join</span>
    </a>
  )
}
