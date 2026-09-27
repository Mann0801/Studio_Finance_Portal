import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { formatPhoneDisplay } from '../../lib/auth'
import { ListSkeleton } from '../../components/Skeleton'

export default function AdminFirstNameOnly() {
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [students, setStudents] = useState(null)

  useEffect(() => {
    adminApi('/api/admin/students').then(setStudents).catch(guard)
  }, [guard])

  // One row per enrollment — a student in two classes appears twice, so
  // dedupe by id first, then flag anyone whose name is a single word (no
  // last name on file, from before signup required one).
  const singleName = useMemo(() => {
    if (!students) return null
    const seen = new Map()
    for (const s of students) {
      if (!seen.has(s.id)) seen.set(s.id, s)
    }
    return [...seen.values()]
      .filter((s) => s.name.trim().split(/\s+/).length === 1)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [students])

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>First Name Only</h1>
        </div>
      </div>
      <p className="muted small" style={{ margin: '0 0 12px' }}>
        These students only have a single word on file as their name — tap one to add a last name.
      </p>

      {singleName === null ? (
        <ListSkeleton rows={4} />
      ) : singleName.length === 0 ? (
        <div className="card empty">Everyone has a full name on file 🎉</div>
      ) : (
        <div className="card flush">
          {singleName.map((s, i) => (
            <div
              key={s.id}
              className="record-row"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/students/${s.id}`)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
            >
              <div className="record-num">{i + 1}</div>
              <div className="record-body">
                <div className="record-name">{s.name}</div>
                <div className="record-fields">
                  <span><b>Phone</b> {formatPhoneDisplay(s.phone)}</span>
                  <span><b>Class</b> {s.batch_label}</span>
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
