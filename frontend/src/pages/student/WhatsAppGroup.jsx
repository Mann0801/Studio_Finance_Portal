import { useDashboard } from '../../context/DashboardContext'
import { whatsappGroupLink, markWhatsappJoined } from '../../lib/whatsapp'
import { WhatsAppIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'
import { BUSINESS } from '../../lib/business'

// Reachable any time from the menu. Shows the student's class WhatsApp group with
// the invite link, so they can join (or re-open it) whenever they like.
export default function WhatsAppGroup() {
  const { data, loading, reload } = useDashboard()
  const student = data?.student
  const link = student ? whatsappGroupLink(student.batch) : null

  const join = () => {
    markWhatsappJoined()
    reload?.()
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>WhatsApp Group</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={2} />}

      {data && !link && (
        <div className="card">
          <span className="card-title">No group for your class yet</span>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
            Your class doesn’t have a WhatsApp group. For any updates or questions, reach the studio
            on {BUSINESS.phones[0]}.
          </p>
        </div>
      )}

      {data && link && (
        <div className="wa-page-card">
          <div className="wa-icon">
            <WhatsAppIcon width={46} height={46} />
          </div>
          <h2>Join our WhatsApp Group</h2>
          <p>
            If you haven’t joined yet, please join using the link below to stay updated with class
            schedules, announcements, payment reminders and important updates from the studio.
          </p>
          <a
            className="btn wa-btn lg block"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={join}
          >
            {student.whatsapp_joined ? 'Open Group' : 'Join Group'}
          </a>
          {student.whatsapp_joined && (
            <p className="wa-joined-note">✓ You’ve joined — tap above to open the group anytime.</p>
          )}
        </div>
      )}
    </>
  )
}
