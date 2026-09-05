import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { ArrowLeftIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

function dateOnly(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

function timeOnly(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
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
        <div className="card flush signup-table" style={{ marginTop: 12 }}>
          <div className="signup-row head">
            <span>Name</span>
            <span>Class</span>
            <span style={{ textAlign: 'right' }}>Signed up</span>
          </div>
          {signups.map((s, i) => (
            <div
              className="signup-row"
              key={`${s.id}-${s.batch}-${i}`}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/students/${s.id}`)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
            >
              <span className="signup-name">{s.name}</span>
              <span className="signup-class">{s.batch_label}</span>
              <span className="signup-when">
                {dateOnly(s.signed_up_at)}
                <br />
                {timeOnly(s.signed_up_at)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
