import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { LOGO_SRC } from '../../lib/brand'
import { ChevronRightIcon } from '../../components/Icons'
import { Skeleton } from '../../components/Skeleton'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const todayLabel = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

function monthProgress() {
  const now = new Date()
  const day = now.getDate()
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' })
  return { day, total, monthName, pct: Math.round((day / total) * 100) }
}

function dateTimeLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
  return `${date}, ${time}`
}

export default function AdminHome() {
  const navigate = useNavigate()
  const { stats, guard } = useAdmin()
  const [activity, setActivity] = useState(null)

  useEffect(() => {
    adminApi('/api/admin/activity').then(setActivity).catch(guard)
  }, [guard])

  const m = monthProgress()

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <img src={LOGO_SRC} alt="I'm Possible Fit" className="topbar-logo" />
          <h1>{greeting()}</h1>
          <div className="hello" style={{ marginTop: 4 }}>{todayLabel()}</div>
        </div>
      </div>

      {/* Quick stats */}
      {!stats ? (
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="stat" key={i}>
              <Skeleton height={26} width="55%" />
              <Skeleton height={13} width="75%" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stat-grid">
          <button type="button" className="stat tappable" onClick={() => navigate('/admin/students')}>
            <div className="num">{stats.total_students}</div>
            <div className="label">Active students</div>
          </button>
          <button
            type="button"
            className="stat tappable"
            onClick={() => navigate('/admin/payments?tab=collected')}
          >
            <div className="num" style={{ color: 'var(--paid)' }}>{stats.paid_count}</div>
            <div className="label">Paid this month</div>
          </button>
          <button
            type="button"
            className="stat tappable"
            onClick={() => navigate('/admin/payments?tab=pending')}
          >
            <div className="num" style={{ color: 'var(--unpaid)' }}>{stats.unpaid_count}</div>
            <div className="label">Unpaid this month</div>
          </button>
          <button
            type="button"
            className="stat tappable"
            onClick={() => navigate('/admin/payments?tab=collected')}
          >
            <div className="num">{rupees(stats.revenue_paise)}</div>
            <div className="label">of {rupees(stats.expected_paise)} expected</div>
          </button>
        </div>
      )}

      {/* Month progress */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="between">
          <strong>{m.monthName} progress</strong>
          <span className="muted small">{m.day}/{m.total} days</span>
        </div>
        <div className="bar"><span style={{ width: `${m.pct}%` }} /></div>
      </div>

      {/* New signups */}
      <div className="card flush" style={{ marginTop: 20 }}>
        <button type="button" className="feed-head feed-head-link" onClick={() => navigate('/admin/signups')}>
          New signups
          <ChevronRightIcon width={16} height={16} />
        </button>
        <div className="list scroll-list">
          {!activity ? (
            <div className="list-item"><Skeleton height={16} width="60%" /></div>
          ) : activity.recent_signups.length === 0 ? (
            <div className="list-item"><span className="muted small">No signups yet.</span></div>
          ) : (
            activity.recent_signups.map((s, i) => (
              <div className="list-item" key={`s${i}`}>
                <span className="li-main">
                  <span className="feed-name">{s.name}</span>
                  <span className="muted small"> · {s.batch_label}</span>
                </span>
                <span className="muted small">{dateTimeLabel(s.signed_up_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ height: 28 }} />
    </>
  )
}
