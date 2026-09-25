import { useNavigate } from 'react-router-dom'
import { MailIcon, ChevronRightIcon } from './Icons'

/** Persistent "add a recovery email" nudge for students who signed up before
 * this was collected — stays visible (with a noticeable pulse) until they add
 * one from Settings, since there's no other way for them to get a self-serve
 * password reset without it. Taps through to Settings rather than collecting
 * the email inline. */
export default function EmailBanner() {
  const navigate = useNavigate()

  return (
    <button type="button" className="email-banner" onClick={() => navigate('/profile')}>
      <span className="email-banner-icon">
        <MailIcon width={18} height={18} />
      </span>
      <span className="email-banner-text">
        <strong>Add a recovery email</strong>
        <span>Used only for password recovery</span>
      </span>
      <ChevronRightIcon width={18} height={18} className="email-banner-chevron" />
    </button>
  )
}
