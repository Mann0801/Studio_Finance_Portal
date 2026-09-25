import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { useClasses, classById, scheduleLabel, slotByKey } from '../../lib/classes'
import { LOGO_SRC, STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
import { formatPhoneDisplay, phoneToTelHref } from '../../lib/auth'
import DueCard from '../../components/DueCard'
import WhatsAppBanner from '../../components/WhatsAppBanner'
import EmailBanner from '../../components/EmailBanner'
import ClassSwitcher from '../../components/ClassSwitcher'
import { CheckIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'
import { whatsappGroupLink } from '../../lib/whatsapp'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "6:30 AM" / "5:00 PM" / "18:00" → minutes since midnight (null if unparseable). */
function parseTime(s) {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3] && m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h * 60 + min
}

/** The soonest UPCOMING class from now, as "Today" / "Tomorrow" / weekday.
 *  Today only counts while its start time is still ahead — once it has passed we
 *  roll forward to the next scheduled day (so Fri night → "Monday", etc.). */
function nextClassLabel(scheduleDays, startMinutes) {
  if (!scheduleDays || !scheduleDays.length) return null
  const now = new Date()
  const todayIdx = (now.getDay() + 6) % 7 // JS Sun=0 → Mon=0
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < 8; i++) {
    const idx = (todayIdx + i) % 7
    if (!scheduleDays.includes(idx)) continue
    if (i === 0) {
      // Today is a class day — only "Today" if it hasn't started yet.
      if (startMinutes == null || nowMinutes < startMinutes) return 'Today'
      continue // already passed → keep looking for the next day
    }
    return i === 1 ? 'Tomorrow' : DAY_FULL[idx]
  }
  return null
}

export default function Home() {
  const { data, loading, error, activeEnrollment, activeClassId, setActiveClassId } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()
  const { classes } = useClasses()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [welcome, setWelcome] = useState(Boolean(state?.welcome))
  // Each class's "just joined" WhatsApp state is independent, keyed by class id.
  const [justJoinedIds, setJustJoinedIds] = useState(() => new Set())

  useEffect(() => {
    if (!welcome) return
    window.history.replaceState({}, '') // don't replay the animation on refresh/back
    const t = setTimeout(() => setWelcome(false), 1900)
    return () => clearTimeout(t)
  }, [welcome])

  const welcomeOverlay = welcome ? (
    <div className="welcome-splash">
      <div className="welcome-check"><CheckIcon width={42} height={42} /></div>
      <div className="welcome-title">You’re in! 🎉</div>
      <div className="welcome-sub">Welcome to {STUDIO_NAME}</div>
    </div>
  ) : null

  if (loading) {
    return (
      <>
        {welcomeOverlay}
        <div className="topbar">
          <div className="greeting">
            <Skeleton height={14} width={90} />
            <Skeleton height={26} width={160} style={{ marginTop: 6 }} />
          </div>
        </div>
        <CardSkeleton lines={1} />
      </>
    )
  }
  if (error) return <>{welcomeOverlay}<p className="error" style={{ marginTop: 24 }}>{error}</p></>
  if (!data || !activeEnrollment) return welcomeOverlay

  const { student, enrollments } = data
  const en = activeEnrollment
  const cls = classById(classes, en.batch)
  const isEnquiry = en.fee_type === 'enquiry'
  const isDeleted = en.batch_deleted
  const isContact = isEnquiry || isDeleted

  // Floating WhatsApp reminder: shown until the student joins this class's group
  // (persisted server-side), then gone. Contact/enquiry classes are exempt.
  const waLink = whatsappGroupLink(cls)
  const showWhatsApp =
    !isContact && !justJoinedIds.has(en.batch) && !en.whatsapp_joined && Boolean(waLink)

  // One pay card per unpaid month — oldest (overdue) first so it's the top
  // priority, current month last. `outstanding` arrives newest→oldest.
  const overdue = [...en.outstanding].reverse()
  const currentUnpaid = en.current.status !== 'paid' && en.current.amount_paise > 0
  const dueMonths = [...overdue, ...(currentUnpaid ? [en.current] : [])]

  const slot = en.batch_slot ? slotByKey(cls, en.batch_slot) : null
  const startTime = slot?.start || cls?.start_time || null
  const nextDay = isContact ? null : nextClassLabel(cls?.schedule_days, parseTime(startTime))
  const classTime =
    en.slot_label ||
    (cls?.start_time && cls?.end_time ? `${cls.start_time} – ${cls.end_time}` : cls?.start_time || '')
  // Includes partial cash — history carries the amount actually received per month.
  const totalPaid = en.history.reduce((s, p) => s + (p.paid_paise || 0), 0)
  const memberSince = new Date(en.join_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <>
      {welcomeOverlay}
      <div className="topbar">
        <div className="greeting">
          <img src={LOGO_SRC} alt="I'm Possible Fit" className="topbar-logo" />
          <h1>{greeting()}, {student.name.split(' ')[0]}</h1>
          <div className="hello" style={{ marginTop: 4 }}>
            {isDeleted ? 'Class removed' : `${en.batch_label} class`}
          </div>
        </div>
      </div>

      {/* Top priority: a student can't self-recover their password without
          this, so it comes before everything else, not buried at the bottom. */}
      {!student.email && <EmailBanner />}

      {enrollments.length > 1 && (
        <ClassSwitcher enrollments={enrollments} activeId={activeClassId} onChange={setActiveClassId} />
      )}

      {/* Hero: one full pay card per unpaid month, oldest (overdue) on top */}
      {isContact ? (
        <div className="pay-card">
          <div className="card-title">{isDeleted ? 'Class no longer available' : 'Contact the studio'}</div>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {isDeleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class is arranged directly with the studio — reach out to sort out your membership and payment.'}
          </p>
          <a className="btn primary lg block" style={{ marginTop: 16 }} href={phoneToTelHref(BUSINESS.phones[0])}>
            Call {formatPhoneDisplay(BUSINESS.phones[0])}
          </a>
          {BUSINESS.phones[1] && (
            <a className="btn ghost block" style={{ marginTop: 8 }} href={phoneToTelHref(BUSINESS.phones[1])}>
              Call {formatPhoneDisplay(BUSINESS.phones[1])}
            </a>
          )}
        </div>
      ) : dueMonths.length === 0 ? (
        <div className="pay-card paid-card">
          <div className="paid-badge"><CheckIcon width={26} height={26} /></div>
          <div className="paid-title">You're all paid up</div>
          <div className="period">{periodLabel(en.current.period)} · {rupees(en.current.amount_paise)} paid</div>
        </div>
      ) : (
        <>
          {dueMonths.map((m, i) => (
            <DueCard
              key={m.period}
              month={m}
              isCurrent={m.period === en.current.period}
              paying={paying}
              onPay={(period) => pay(period, en.batch)}
              style={i > 0 ? { marginTop: 12 } : undefined}
            />
          ))}
          {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
        </>
      )}

      {/* Next class */}
      {nextDay && (
        <div className="card next-class" style={{ marginTop: 16 }}>
          <span className="card-title">Next class</span>
          <div className="nc-when">{nextDay}{classTime ? ` · ${classTime}` : ''}</div>
        </div>
      )}

      {/* Your class */}
      {cls && (
        <div
          className="card class-home tappable"
          style={{ marginTop: 16 }}
          role="button"
          tabIndex={0}
          onClick={() => navigate('/profile')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/profile')}
        >
          <span className="card-title">Your class</span>
          <div className="ch-name">{cls.name}</div>
          {(scheduleLabel(cls) || en.slot_label) && (
            <div className="ch-sched">
              {[scheduleLabel(cls), en.slot_label].filter(Boolean).join(' · ')}
            </div>
          )}
          {cls.description && <p className="ch-desc">{cls.description}</p>}
        </div>
      )}

      {/* Membership summary */}
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="num" style={{ fontSize: 15 }}>{memberSince}</div>
          <div className="label">
            Member since · {en.days_member} {en.days_member === 1 ? 'day' : 'days'}
          </div>
        </div>
        <button type="button" className="stat tappable" onClick={() => navigate('/payments')}>
          <div className="num" style={{ fontSize: 16 }}>{rupees(totalPaid)}</div>
          <div className="label">Total paid</div>
        </button>
      </div>

      {/* Non-blocking reminder, in the flow at the bottom so it covers nothing. */}
      {showWhatsApp && (
        <WhatsAppBanner
          link={waLink}
          classId={en.batch}
          onJoined={() => setJustJoinedIds((prev) => new Set(prev).add(en.batch))}
        />
      )}

      <div style={{ height: 20 }} />
    </>
  )
}
