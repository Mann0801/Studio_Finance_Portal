import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, clearAdminToken } from '../../lib/adminApi'
import { BATCHES, rupees } from '../../lib/batches'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [batch, setBatch] = useState('yoga')
  const [stats, setStats] = useState(null)
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')

  const logout = useCallback(() => {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }, [navigate])

  const guard = useCallback(
    (e) => {
      setError(e.message)
      if (e.message.includes('log in')) logout()
    },
    [logout],
  )

  useEffect(() => {
    adminApi('/api/admin/stats').then(setStats).catch(guard)
  }, [guard])

  useEffect(() => {
    let active = true
    adminApi(`/api/admin/batches/${batch}`)
      .then((d) => active && setStudents(d))
      .catch((e) => active && guard(e))
    return () => {
      active = false
    }
  }, [batch, guard])

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>Admin · {stats ? stats.period : ''}</h1>
        <button className="link-btn" onClick={logout}>
          Log out
        </button>
      </header>

      {stats && (
        <section className="cards admin-stats">
          <div className="card">
            <h2>Revenue this month</h2>
            <p className="amount">{rupees(stats.revenue_paise)}</p>
          </div>
          <div className="card">
            <h2>Paid / Unpaid</h2>
            <p className="amount">
              {stats.paid_count} / {stats.unpaid_count}
            </p>
            <p className="muted">of {stats.total_students} students</p>
          </div>
          <div className="card">
            <h2>Attendance</h2>
            <p className="amount">{stats.attendance_this_month}</p>
            <p className="muted">check-ins this month</p>
          </div>
        </section>
      )}

      <nav className="tabs">
        {BATCHES.map((b) => (
          <button
            key={b.id}
            className={`tab ${batch === b.id ? 'active' : ''}`}
            onClick={() => setBatch(b.id)}
          >
            {b.label}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}

      <section className="history">
        {students.length === 0 ? (
          <p className="muted">No students in this batch yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Due</th>
                <th>Status</th>
                <th>Reminder</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.phone}</td>
                  <td>{rupees(s.amount_paise)}</td>
                  <td>
                    <span className={`badge ${s.status}`}>{s.status}</span>
                  </td>
                  <td>
                    {s.whatsapp_url ? (
                      <a
                        className="wa-btn"
                        href={s.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
