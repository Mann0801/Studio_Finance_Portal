import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { expectedJoinDate } from '../../lib/joinDate'
import { rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import { ListSkeleton } from '../../components/Skeleton'

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminJoinDateCheck() {
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [students, setStudents] = useState(null)

  useEffect(() => {
    adminApi('/api/admin/students').then(setStudents).catch(guard)
  }, [guard])

  // Existing members should be set to the 1st of the month they signed up in
  // (see the signup notice) — anything else is worth a human glance, since
  // an old real join date silently makes the app think they owe back-months
  // of dues from before they were ever in the system.
  //
  // Scoped to THIS calendar month's signups only — otherwise old testers from
  // prior months (deliberately left with a real historical join date, already
  // reviewed once) pile up here forever alongside genuinely new cases, since
  // nothing here ever gets marked "reviewed."
  const thisMonthFirst = useMemo(() => expectedJoinDate(new Date().toISOString()), [])

  const mismatched = useMemo(() => {
    if (!students) return null
    return students
      .filter((s) => expectedJoinDate(s.signed_up_at) === thisMonthFirst)
      .filter((s) => s.join_date !== expectedJoinDate(s.signed_up_at))
      .sort((a, b) => a.join_date.localeCompare(b.join_date))
  }, [students, thisMonthFirst])

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Join Date Check</h1>
        </div>
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        Existing members should have their join date set to the 1st of the month they signed up
        in. These signed up this month but don't match that — tap one to review or correct it. If
        they've already paid, that amount was pro-rated off the wrong date, so it's worth
        double-checking.
      </p>

      {mismatched === null ? (
        <ListSkeleton rows={4} />
      ) : mismatched.length === 0 ? (
        <div className="card empty">Everyone's join date looks right 🎉</div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {mismatched.map((s) => (
            <div
              key={`${s.id}-${s.batch}`}
              className="student-card tappable"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/students/${s.id}`)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
            >
              <div className="avatar">{s.name.charAt(0).toUpperCase()}</div>
              <div className="s-info">
                <div className="s-name">{s.name}</div>
                <div className="s-sub">
                  {s.batch_label}
                  {s.slot_label ? ` · ${s.slot_label}` : ''}
                  {s.batch_deleted ? ' · Batch Deleted' : ''}
                  {s.is_prorata ? ' · pro-rated' : ''}
                </div>
              </div>
              <div className="s-right">
                <div className="s-status-row">
                  <span className="s-amount unpaid">{fmtDate(s.join_date)}</span>
                </div>
                <div className="s-status-row">
                  <span className={`s-amount ${s.status}`}>{rupees(s.amount_paise)}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
