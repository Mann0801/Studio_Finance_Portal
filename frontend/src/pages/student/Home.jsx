import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { useClasses, classById, scheduleLabel, slotByKey } from '../../lib/classes'
import { LOGO_SRC, STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
import DueCard from '../../components/DueCard'
import WhatsAppBanner from '../../components/WhatsAppBanner'
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
  const { data, loading, error } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()
  const { classes } = useClasses()
  const { state } = useLocation()
  const [welcome, setWelcome] = useState(Boolean(state?.welcome))
  const [waJustJoined, setWaJustJoined] = useState(false)

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
  if (!data) return welcomeOverlay

  const { student, current, history = [], outstanding = [] } = data
  const cls = classById(classes, student.batch)
  const isEnquiry = student.fee_type === 'enquiry'
  const isDeleted = student.batch_deleted
  const isContact = isEnquiry || isDeleted

  // Floating WhatsApp reminder: shown until the student joins their class's group
  // (persisted server-side), then gone. Contact/enquiry classes are exempt.
  const showWhatsApp =
    !isContact &&
    !waJustJoined &&
    !student.whatsapp_joined &&
    Boolean(whatsappGroupLink(student.batch))

  // One pay card per unpaid month — oldest (overdue) first so it's the top
  // priority, current month last. `outstanding` arrives newest→oldest.
  const overdue = [...outstanding].reverse()
  const currentUnpaid = current.status !== 'paid' && current.amount_paise > 0
  const dueMonths = [...overdue, ...(currentUnpaid ? [current] : [])]

  const slot = student.batch_slot ? slotByKey(cls, student.batch_slot) : null
  const startTime = slot?.start || cls?.start_time || null
  const nextDay = isContact ? null : nextClassLabel(cls?.schedule_days, parseTime(startTime))
  const classTime =
    student.slot_label ||
    (cls?.start_time && cls?.end_time ? `${cls.start_time} – ${cls.end_time}` : cls?.start_time || '')
  const totalPaid = history.reduce((s, p) => (p.status === 'paid' ? s + p.amount_paise : s), 0)
  const memberSince = new Date(student.join_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  // Days since the studio joining date, counted inclusively so the join day is
  // day 1 (local time).
  const [jy, jm, jd] = student.join_date.split('-').map(Number)
  const daysMember =
    Math.max(0, Math.floor((Date.now() - new Date(jy, jm - 1, jd).getTime()) / 86400000)) + 1

  return (
    <>
      {welcomeOverlay}
      <div className="topbar">
        <div className="greeting">
          <img src={LOGO_SRC} alt="I'm Possible Fit" className="topbar-logo" />
          <h1>{greeting()}, {student.name.split(' ')[0]}</h1>
          <div className="hello" style={{ marginTop: 4 }}>
            {isDeleted ? 'Class removed' : `${student.batch_label} class`}
          </div>
        </div>
      </div>

      {/* Hero: one full pay card per unpaid month, oldest (overdue) on top */}
      {isContact ? (
        <div className="pay-card">
          <div className="card-title">{isDeleted ? 'Class no longer available' : 'Contact the studio'}</div>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {isDeleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class is arranged directly with the studio — reach out to sort out your membership and payment.'}
          </p>
          <a className="btn primary lg block" style={{ marginTop: 16 }} href={`tel:${BUSINESS.phones[0]}`}>
            Call {BUSINESS.phones[0]}
          </a>
          {BUSINESS.phones[1] && (
            <a className="btn ghost block" style={{ marginTop: 8 }} href={`tel:${BUSINESS.phones[1]}`}>
              Call {BUSINESS.phones[1]}
            </a>
          )}
        </div>
      ) : dueMonths.length === 0 ? (
        <div className="pay-card paid-card">
          <div className="paid-badge"><CheckIcon width={26} height={26} /></div>
          <div className="paid-title">You're all paid up</div>
          <div className="period">{periodLabel(current.period)} · {rupees(current.amount_paise)} paid</div>
        </div>
      ) : (
        <>
          {dueMonths.map((m, i) => (
            <DueCard
              key={m.period}
              month={m}
              isCurrent={m.period === current.period}
              paying={paying}
              onPay={pay}
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
        <div className="card class-home" style={{ marginTop: 16 }}>
          <span className="card-title">Your class</span>
          <div className="ch-name">{cls.name}</div>
          {(scheduleLabel(cls) || student.slot_label) && (
            <div className="ch-sched">
              {[scheduleLabel(cls), student.slot_label].filter(Boolean).join(' · ')}
            </div>
          )}
          {cls.description && <p className="ch-desc">{cls.description}</p>}
        </div>
      )}

      {/* Membership summary */}
      <div className="stat-grid stat-grid-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="num" style={{ fontSize: 14.5 }}>{memberSince}</div>
          <div className="label">Member since</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 16 }}>{daysMember}</div>
          <div className="label">{daysMember === 1 ? 'Day as member' : 'Days as member'}</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 16 }}>{rupees(totalPaid)}</div>
          <div className="label">Total paid</div>
        </div>
      </div>

      {/* Non-blocking reminder, in the flow at the bottom so it covers nothing. */}
      {showWhatsApp && (
        <WhatsAppBanner batch={student.batch} onJoined={() => setWaJustJoined(true)} />
      )}

      <div style={{ height: 20 }} />
    </>
  )
}
