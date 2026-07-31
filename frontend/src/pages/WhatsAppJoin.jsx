import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { whatsappGroupLink } from '../lib/whatsapp'
import { WhatsAppIcon } from '../components/Icons'

// Shown once, right after signup (see Signup / ProfileSetup), for classes that
// have a WhatsApp group. Mandatory — there is no skip; tapping "Join Group"
// opens the invite in a new tab and moves the app itself to the home page.
export default function WhatsAppJoin() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const link = state?.batch ? whatsappGroupLink(state.batch) : null

  // Reached without a batch/link (direct URL, refresh, or a class with no group)
  // — nothing to do here, so fall through to the home page.
  if (!link) return <Navigate to="/" replace />

  const goHome = () => {
    // Defer so the anchor's default (open WhatsApp) fires before we unmount.
    setTimeout(() => navigate('/', { replace: true, state: { welcome: true } }), 0)
  }

  return (
    <div className="wa-join">
      <div className="wa-join-inner">
        <div className="wa-icon">
          <WhatsAppIcon width={54} height={54} />
        </div>
        <h1>Join our WhatsApp Group</h1>
        <p>
          Stay updated with class schedules, announcements and important updates from the studio.
        </p>
        <a
          className="btn wa-btn lg block"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={goHome}
        >
          Join Group
        </a>
      </div>
    </div>
  )
}
