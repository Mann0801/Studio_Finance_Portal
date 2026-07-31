import { whatsappGroupLink, markJoinedWhatsapp } from '../lib/whatsapp'
import { WhatsAppIcon } from './Icons'

// Blocking prompt shown over the home screen until the student joins their
// class's WhatsApp group. There is no close/skip — it demands attention. Tapping
// "Join Group" opens the invite, remembers the choice (so it never returns), and
// clears the prompt. Renders nothing for classes without a group.
export default function WhatsAppJoinModal({ studentId, batch, onDone }) {
  const link = whatsappGroupLink(batch)
  if (!link) return null

  const join = () => {
    markJoinedWhatsapp(studentId)
    onDone()
  }

  return (
    <div className="wa-modal-backdrop">
      <div className="wa-modal">
        <div className="wa-icon">
          <WhatsAppIcon width={46} height={46} />
        </div>
        <h2>Join our WhatsApp Group</h2>
        <p>
          Stay updated with class schedules, announcements and important updates from the studio.
        </p>
        <a
          className="btn wa-btn lg block"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={join}
        >
          Join Group
        </a>
        <p className="wa-note">
          Please join the group to continue — class schedules, payment reminders and announcements
          are shared there.
        </p>
      </div>
    </div>
  )
}
