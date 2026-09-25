import { Link, useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { formatPhoneDisplay } from '../../lib/auth'
import { PlusIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

export default function Profile() {
  const { data, loading, error } = useDashboard()
  const navigate = useNavigate()

  const enrollments = data?.enrollments ?? []

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Settings</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={3} />}
      {error && <p className="error">{error}</p>}

      {data && (
        <div className="stack">
          <div className="card row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 54, height: 54, fontSize: 22 }}>
              {data.student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{data.student.name}</div>
              <div className="muted small">
                {enrollments.length} class{enrollments.length === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          <div className="card flush list">
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{formatPhoneDisplay(data.student.phone)}</span>
            </div>
            <div className="list-item">
              <span className="muted">Recovery email</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {data.student.email || 'Not added'}
              </span>
            </div>
          </div>

          {enrollments.length > 0 && (
            <div className="card flush">
              <div className="data-row head">
                <span>Class</span>
                <span>Timing</span>
                <span style={{ textAlign: 'right' }}>Joined</span>
              </div>
              {enrollments.map((en) => (
                <div className="data-row static" key={en.batch}>
                  <span className="data-name">{en.batch_label}</span>
                  <span className="data-sub">{en.slot_label || '—'}</span>
                  <div className="data-end">
                    {new Date(en.join_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/add-class" className="btn ghost block">
            <PlusIcon width={16} height={16} /> Add a class
          </Link>

          <button className="btn primary block" onClick={() => navigate('/profile/edit')}>
            Edit profile
          </button>
        </div>
      )}
    </>
  )
}
