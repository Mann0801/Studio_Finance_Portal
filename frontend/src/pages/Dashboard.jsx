import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { rupees } from '../lib/batches'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { signOut } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/me/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="center error">{error}</div>
  if (!data) return <div className="center muted">Loading your dashboard…</div>

  const { student, current, history, attendance_this_month } = data
  const paid = current.status === 'paid'

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <h1>Hi, {student.name}</h1>
          <p className="muted">
            {student.batch_label} batch · joined {student.join_date}
          </p>
        </div>
        <button className="link-btn" onClick={signOut}>
          Log out
        </button>
      </header>

      <section className="cards">
        <div className="card">
          <h2>This month ({current.period})</h2>
          <p className="amount">{rupees(current.amount_paise)}</p>
          <span className={`badge ${paid ? 'paid' : 'unpaid'}`}>
            {paid ? 'Paid' : 'Unpaid'}
          </span>
          {current.is_prorata && <p className="muted small">Pro-rated first month</p>}
          {!paid && (
            <button className="primary" disabled title="Payments arrive in the next step">
              Pay now (coming soon)
            </button>
          )}
        </div>

        <div className="card">
          <h2>Attendance</h2>
          <p className="amount">{attendance_this_month}</p>
          <p className="muted">days this month</p>
          <button className="secondary" disabled title="QR scan arrives in a later step">
            Scan QR (coming soon)
          </button>
        </div>
      </section>

      <section className="history">
        <h2>Payment history</h2>
        {history.length === 0 ? (
          <p className="muted">No payments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid on</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.period}>
                  <td>{p.period}</td>
                  <td>{rupees(p.amount_paise)}</td>
                  <td>
                    <span className={`badge ${p.status === 'paid' ? 'paid' : 'unpaid'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
