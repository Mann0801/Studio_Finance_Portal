import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import { ListSkeleton } from '../../components/Skeleton'

const TABS = [
  { id: 'missing', label: 'Missing' },
  { id: 'has', label: 'Has Email' },
]

export default function AdminMissingEmailCheck() {
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [students, setStudents] = useState(null)
  const [tab, setTab] = useState('missing')

  useEffect(() => {
    adminApi('/api/admin/students').then(setStudents).catch(guard)
  }, [guard])

  // Anyone signed up before the recovery-email field existed (or who just
  // hasn't filled in the Home-screen banner yet) — they can't self-serve a
  // password reset until they add one.
  const missing = useMemo(() => {
    if (!students) return null
    return students.filter((s) => !s.email)
  }, [students])
  const hasEmail = useMemo(() => {
    if (!students) return null
    return students.filter((s) => s.email)
  }, [students])

  const rows = tab === 'missing' ? missing : hasEmail

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Recovery Email</h1>
        </div>
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        {tab === 'missing'
          ? "These students haven't added a recovery email yet, so they can't reset their own password if they forget it — they'll need to message you instead until they add one from the banner on their Home screen."
          : 'These students have added a recovery email and can self-serve a password reset.'}
      </p>

      <div className="seg" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`seg-opt ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {(t.id === 'missing' ? missing : hasEmail)?.length > 0
              ? ` (${(t.id === 'missing' ? missing : hasEmail).length})`
              : ''}
          </button>
        ))}
      </div>

      {rows === null ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="card empty">
          {tab === 'missing' ? 'Everyone has a recovery email on file 🎉' : 'No one has added a recovery email yet.'}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.map((s) => (
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
                </div>
                {tab === 'has' && <div className="s-sub">{s.email}</div>}
              </div>
              <div className="s-right">
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
