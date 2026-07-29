import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { useClasses, classById, scheduleLabel, slotByKey } from '../../lib/classes'
import { LOGO_SRC, STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
import StatusBadge from '../../components/StatusBadge'
import { CheckIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'

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
  const paid = current.status === 'paid'
  const isEnquiry = student.fee_type === 'enquiry'
  const isDeleted = student.batch_deleted
  const isContact = isEnquiry || isDeleted

  const slot = student.batch_slot ? slotByKey(cls, student.batch_slot) : null
  const startTime = slot?.start || cls?.start_time || null
  const nextDay = isContact ? null : nextClassLabel(cls?.schedule_days, parseTime(startTime))
  const classTime =
    student.slot_label ||
    (cls?.start_time && cls?.end_time ? `${cls.start_time} – ${cls.end_time}` : cls?.start_time || '')
  const totalPaid = history.reduce((s, p) => (p.status === 'paid' ? s + p.amount_paise : s), 0)
  const memberSince = new Date(student.join_date).toLocaleDateString('en-IN', {
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
            {isDeleted ? 'Class removed' : `${student.batch_label} class`}
          </div>
        </div>
      </div>

      {/* Hero card */}
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
      ) : paid ? (
        <div className="pay-card paid-card">
          <div className="paid-badge"><CheckIcon width={26} height={26} /></div>
          <div className="paid-title">You're all paid up</div>
          <div className="period">{periodLabel(current.period)} · {rupees(current.amount_paise)} paid</div>
        </div>
      ) : (
        <div className="pay-card">
          <div className="between">
            <span className="card-title">Amount due</span>
            <StatusBadge status={current.status} />
          </div>
          <div className="amount">{rupees(current.amount_paise)}</div>
          <div className="period">
            {periodLabel(current.period)}
            {current.is_prorata ? ' · pro-rated first month' : ''}
          </div>
          {current.amount_paise > 0 && (
            <button
              className="btn primary lg block"
              style={{ marginTop: 18 }}
              onClick={() => pay()}
              disabled={paying}
            >
              {paying ? 'Processing…' : `Pay ${rupees(current.amount_paise)} now`}
            </button>
          )}
          {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
        </div>
      )}

      {outstanding.length > 0 && (
        <Link to="/payments" className="due-alert">
          <span>
            {outstanding.length === 1
              ? '1 earlier month is unpaid'
              : `${outstanding.length} earlier months are unpaid`}
          </span>
          <span className="due-alert-cta">Pay now →</span>
        </Link>
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
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="num" style={{ fontSize: 19 }}>{memberSince}</div>
          <div className="label">Member since</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 19 }}>{rupees(totalPaid)}</div>
          <div className="label">Total paid</div>
        </div>
      </div>

      <div style={{ height: 20 }} />
    </>
  )
}
