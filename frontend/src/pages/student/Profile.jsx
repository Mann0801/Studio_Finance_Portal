import { useAuth } from '../../context/AuthContext'
import { useDashboard } from '../../context/DashboardContext'
import { CardSkeleton } from '../../components/Skeleton'

export default function Profile() {
  const { signOut } = useAuth()
  const { data, loading, error } = useDashboard()

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Profile</h1>
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
              <div className="muted small">{data.student.batch_label} batch</div>
            </div>
          </div>

          <div className="card flush list">
            <div className="list-item">
              <span className="muted">Email</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.email}</span>
            </div>
            <div className="list-item">
              <span className="muted">Phone</span>
              <span className="li-main" style={{ fontSize: 14 }}>{data.student.phone}</span>
            </div>
            <div className="list-item">
              <span className="muted">Joined</span>
              <span className="li-main" style={{ fontSize: 14 }}>
                {new Date(data.student.join_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <button className="btn danger block" onClick={signOut}>
            Log out
          </button>
        </div>
      )}
    </>
  )
}
