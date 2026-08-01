import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { PlusIcon, ChevronRightIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

export default function AdminClasses() {
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [classes, setClasses] = useState(null)

  const load = useCallback(() => {
    adminApi('/api/admin/classes').then(setClasses).catch(guard)
  }, [guard])
  useEffect(() => load(), [load])

  const activeClasses = (classes || []).filter((c) => c.active)

  return (
    <>
      <div className="topbar">
        <div className="greeting"><h1>Classes</h1></div>
      </div>

      <button
        className="btn primary block"
        style={{ marginBottom: 14 }}
        onClick={() => navigate('/admin/classes/new')}
      >
        <PlusIcon width={18} height={18} /> Add New Class
      </button>

      {classes === null ? (
        <ListSkeleton rows={5} />
      ) : activeClasses.length === 0 ? (
        <div className="card empty">No classes yet — tap “Add New Class”.</div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {activeClasses.map((c) => (
            <button
              key={c.id}
              className="class-name-row"
              onClick={() => navigate(`/admin/classes/${c.id}`)}
            >
              <span className="cls-avatar">{c.name.charAt(0).toUpperCase()}</span>
              <span className="cls-title">{c.name}</span>
              <ChevronRightIcon className="bc-chev" width={20} height={20} />
            </button>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
