import { useDashboard } from '../../context/DashboardContext'
import { whatsappGroupLink, markWhatsappJoined } from '../../lib/whatsapp'
import { useClasses, classById } from '../../lib/classes'
import { WhatsAppIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'
import { BUSINESS } from '../../lib/business'

// Reachable any time from the menu. Shows every one of the student's classes'
// WhatsApp groups with their invite links, so they can join (or re-open) each
// whenever they like.
export default function WhatsAppGroup() {
  const { data, loading, reload } = useDashboard()
  const { classes } = useClasses()
  const enrollments = data?.enrollments ?? []

  const groups = enrollments.map((en) => ({
    enrollment: en,
    link: whatsappGroupLink(classById(classes, en.batch)),
  }))
  const withLinks = groups.filter((g) => g.link)

  const join = (classId) => {
    markWhatsappJoined(classId)
    reload?.()
  }

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>WhatsApp Group{enrollments.length > 1 ? 's' : ''}</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={2} />}

      {data && withLinks.length === 0 && (
        <div className="card">
          <span className="card-title">No group for your class yet</span>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
            Your class doesn’t have a WhatsApp group. For any updates or questions, reach the studio
            on {BUSINESS.phones[0]}.
          </p>
        </div>
      )}

      {withLinks.map(({ enrollment: en, link }) => (
        <div className="wa-page-card" key={en.batch} style={{ marginTop: 12 }}>
          <div className="wa-icon">
            <WhatsAppIcon width={46} height={46} />
          </div>
          <h2>{en.batch_label}</h2>
          <p>
            If you haven’t joined yet, please join using the link below to stay updated with class
            schedules, announcements, payment reminders and important updates from the studio.
          </p>
          <a
            className="btn wa-btn lg block"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => join(en.batch)}
          >
            Join Group
          </a>
        </div>
      ))}
    </>
  )
}
