import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { ArrowLeftIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

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

export default function AdminSignups() {
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [signups, setSignups] = useState(null)

  useEffect(() => {
    adminApi('/api/admin/signups').then(setSignups).catch(guard)
  }, [guard])

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>All signups</h1>
          {signups && (
            <div className="hello" style={{ marginTop: 2 }}>
              {signups.length} enrollment{signups.length === 1 ? '' : 's'} ever
            </div>
          )}
        </div>
      </div>

      {signups === null ? (
        <ListSkeleton rows={6} />
      ) : signups.length === 0 ? (
        <div className="card empty">No signups yet.</div>
      ) : (
        <div className="card flush" style={{ marginTop: 12 }}>
          <div className="list">
            {signups.map((s, i) => (
              <div
                className="list-item tappable"
                key={`${s.id}-${s.batch}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/students/${s.id}`)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
              >
                <span className="li-main">
                  <span className="feed-name">{s.name}</span>
                  <span className="muted small"> · {s.batch_label}</span>
                </span>
                <span className="muted small">{dateTimeLabel(s.signed_up_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
