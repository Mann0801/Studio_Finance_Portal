import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { BATCHES, TRADITIONAL_SLOTS, rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import { WhatsAppIcon, SearchIcon, PlusIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid' },
]

export default function AdminStudents() {
  const navigate = useNavigate()
  const { stats, guard } = useAdmin()
  const [batch, setBatch] = useState('senior_citizens_yoga')
  const [slot, setSlot] = useState('batch1') // persists across tab switches
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let active = true
    const q = batch === 'traditional_yoga' ? `?slot=${slot}` : ''
    adminApi(`/api/admin/batches/${batch}${q}`)
      .then((d) => active && setStudents(d))
      .catch((e) => active && guard(e))
    return () => {
      active = false
    }
  }, [batch, slot, guard])

  const selectBatch = (id) => {
    if (id === batch) return
    setStudents(null)
    setBatch(id)
  }
  const selectSlot = (id) => {
    if (id === slot) return
    setStudents(null)
    setSlot(id)
  }

  const batchStat = (id) => stats?.per_batch.find((b) => b.batch === id)
  const slotStat = (id) => batchStat('traditional_yoga')?.slots.find((s) => s.slot === id)

  const visible = useMemo(() => {
    if (!students) return null
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [students, search, filter])

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Students</h1>
        </div>
        <button className="btn primary add-btn" onClick={() => navigate('/admin/students/new')}>
          <PlusIcon width={18} height={18} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="search">
        <SearchIcon width={18} height={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          autoCapitalize="none"
        />
      </div>

      {/* Batch tabs */}
      <div className="chips" style={{ marginTop: 12 }}>
        {BATCHES.map((b) => {
          const count = batchStat(b.id)?.total_students
          return (
            <button
              key={b.id}
              className={`chip ${batch === b.id ? 'active' : ''}`}
              onClick={() => selectBatch(b.id)}
            >
              {b.label}{count != null ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Traditional Yoga timing sub-tabs */}
      {batch === 'traditional_yoga' && (
        <div className="chips sub-chips">
          {TRADITIONAL_SLOTS.map((s) => {
            const count = slotStat(s.id)?.total_students
            return (
              <button
                key={s.id}
                className={`chip ${slot === s.id ? 'active' : ''}`}
                onClick={() => selectSlot(s.id)}
              >
                {s.time}{count != null ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* Paid / unpaid filter */}
      <div className="seg" style={{ marginTop: 4 }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`seg-opt ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Student cards */}
      {visible === null ? (
        <ListSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <div className="card empty">
          {students && students.length > 0 ? 'No students match.' : 'No students in this batch yet.'}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {visible.map((s) => (
            <div
              className="student-card tappable"
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/students/${s.id}`)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/admin/students/${s.id}`)}
            >
              <div className="avatar">{s.name.charAt(0).toUpperCase()}</div>
              <div className="s-info">
                <div className="s-name">{s.name}</div>
                <div className="s-sub">
                  {rupees(s.amount_paise)} · {s.phone}
                  {s.slot_label ? ` · ${s.slot_label}` : ''}
                </div>
              </div>
              <div className="s-right">
                <StatusBadge status={s.status} />
                {s.whatsapp_url && (
                  <a
                    className="wa-btn"
                    href={s.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <WhatsAppIcon width={16} height={16} /> Message
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 28 }} />
    </>
  )
}
