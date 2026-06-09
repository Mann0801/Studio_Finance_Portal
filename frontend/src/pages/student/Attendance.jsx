import { useDashboard } from '../../context/DashboardContext'
import { CardSkeleton } from '../../components/Skeleton'

export default function Attendance() {
  const { data, loading, error } = useDashboard()

  const count = data?.attendance_this_month ?? 0
  // Visual ring out of a nominal monthly target (e.g. 20 classes).
  const target = 20
  const pct = Math.min(count / target, 1)

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Attendance</h1>
        </div>
      </div>

      {loading && <CardSkeleton lines={1} />}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="card">
            <div className="att-hero">
              <div className="att-ring" style={{ '--pct': `${pct * 360}deg` }}>
                <div className="inner">{count}</div>
              </div>
              <div>
                <h2 style={{ fontSize: 20 }}>This month</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  {count === 0 ? 'No classes yet' : `${count} class${count === 1 ? '' : 'es'} attended`}
                </p>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 6 }}>Mark today's attendance</h3>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Scan the studio QR code at the entrance to check in.
            </p>
            <button className="btn block" disabled title="QR check-in arrives in a later update">
              Scan QR — coming soon
            </button>
          </div>
        </>
      )}
    </>
  )
}
