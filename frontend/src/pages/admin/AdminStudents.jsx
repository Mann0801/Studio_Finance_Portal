import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { useClasses, scheduleLabel } from '../../lib/classes'
import StatusBadge from '../../components/StatusBadge'
import {
  WhatsAppIcon,
  SearchIcon,
  PlusIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid' },
]

const pct = (paid, total) => (total ? Math.round((paid / total) * 100) : 0)

/** A batch/slot summary card (Level 1 + the timing screen). */
function OverviewCard({ title, badge, subtitle, stat, onClick }) {
  const total = stat?.total_students ?? 0
  const paid = stat?.paid_count ?? 0
  const unpaid = stat?.unpaid_count ?? 0
  return (
    <button className="batch-card" onClick={onClick}>
      <div className="bc-main">
        <div className="bc-name">{title}{badge}</div>
        {subtitle && <div className="bc-sched">{subtitle}</div>}
        <div className="bc-stats">
          <span className="bc-total">{total} student{total === 1 ? '' : 's'}</span>
          <span className="bc-dot paid">{paid} paid</span>
          <span className="bc-dot unpaid">{unpaid} unpaid</span>
        </div>
      </div>
      <div className="bc-right">
        <div className="bc-rate">{paid}/{total}</div>
        <div className="bc-rate-pct">{pct(paid, total)}%</div>
        <ChevronRightIcon className="bc-chev" width={20} height={20} />
      </div>
    </button>
  )
}

export default function AdminStudents() {
  const navigate = useNavigate()
  const { stats, guard } = useAdmin()
  const { classes } = useClasses()
  const clsMap = useMemo(() => new Map((classes || []).map((c) => [c.id, c])), [classes])
  const perBatch = stats?.per_batch || []

  const [view, setView] = useState('batches') // 'batches' | 'slots' | 'students'
  const [activeBatch, setActiveBatch] = useState(null) // a per_batch entry
  const [activeSlot, setActiveSlot] = useState(null) // slot key | null
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const slotName = (batchId, key) =>
    clsMap.get(batchId)?.slots?.find((s) => s.key === key)?.name

  const fetchStudents = useCallback(
    (batchId, slotId) => {
      setStudents(null)
      const q = slotId ? `?slot=${slotId}` : ''
      adminApi(`/api/admin/batches/${batchId}${q}`).then(setStudents).catch(guard)
    },
    [guard],
  )

  const openStudents = (entry, slotId) => {
    setActiveBatch(entry)
    setActiveSlot(slotId)
    setSearch('')
    setFilter('all')
    setView('students')
    fetchStudents(entry.batch, slotId)
  }

  const openBatch = (entry) => {
    if (entry.slots?.length) {
      setActiveBatch(entry)
      setView('slots')
    } else {
      openStudents(entry, null)
    }
  }

  const visible = useMemo(() => {
    if (!students) return null
    const q = search.trim().toLowerCase()
    return students
      .filter((s) => {
        if (filter !== 'all' && s.status !== filter) return false
        if (q && !s.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'unpaid' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [students, search, filter])

  // ── Level 1: classes overview ──────────────────────────────────────────────
  if (view === 'batches') {
    return (
      <>
        <div className="topbar">
          <div className="greeting"><h1>Students</h1></div>
        </div>

        <button
          className="btn primary block"
          style={{ marginBottom: 14 }}
          onClick={() => navigate('/admin/students/new')}
        >
          <PlusIcon width={18} height={18} /> Add student
        </button>

        {!stats ? (
          <ListSkeleton rows={5} />
        ) : perBatch.length === 0 ? (
          <div className="card empty">No classes yet — add one from the Classes tab.</div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {perBatch.map((e) => {
              const cls = clsMap.get(e.batch)
              return (
                <OverviewCard
                  key={e.batch}
                  title={e.batch_label}
                  badge={!cls ? <span className="mini-badge">Deleted</span> : null}
                  subtitle={cls ? scheduleLabel(cls) : 'Removed class'}
                  stat={e}
                  onClick={() => openBatch(e)}
                />
              )
            })}
          </div>
        )}
        <div style={{ height: 28 }} />
      </>
    )
  }

  // ── Timing picker (classes with slots) ─────────────────────────────────────
  if (view === 'slots') {
    return (
      <>
        <div className="topbar with-back">
          <button className="back-btn" aria-label="Back" onClick={() => setView('batches')}>
            <ArrowLeftIcon width={22} height={22} />
          </button>
          <div className="greeting">
            <h1>{activeBatch.batch_label}</h1>
            <div className="hello" style={{ marginTop: 2 }}>Choose a timing</div>
          </div>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          {activeBatch.slots.map((s) => (
            <OverviewCard
              key={s.slot}
              title={slotName(activeBatch.batch, s.slot) || s.slot_label}
              subtitle={s.slot_label}
              stat={s}
              onClick={() => openStudents(activeBatch, s.slot)}
            />
          ))}
        </div>
        <div style={{ height: 28 }} />
      </>
    )
  }

  // ── Level 2: students in a class/slot ──────────────────────────────────────
  const cls = clsMap.get(activeBatch.batch)
  const st = activeSlot ? activeBatch.slots.find((s) => s.slot === activeSlot) : activeBatch
  const total = st?.total_students ?? students?.length ?? 0
  const paidN = st?.paid_count ?? 0
  const unpaidN = st?.unpaid_count ?? 0
  const subtitle = activeSlot ? st?.slot_label ?? '' : cls ? scheduleLabel(cls) : ''
  const backToLevel1 = () => setView(activeBatch.slots?.length ? 'slots' : 'batches')

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={backToLevel1}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>{activeBatch.batch_label}</h1>
          {subtitle && <div className="hello" style={{ marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stat-grid stat-grid-3">
        <div className="stat"><div className="num">{total}</div><div className="label">Total</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--paid)' }}>{paidN}</div><div className="label">Paid</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--unpaid)' }}>{unpaidN}</div><div className="label">Unpaid</div></div>
      </div>

      {/* Search */}
      <div className="search" style={{ marginTop: 12 }}>
        <SearchIcon width={18} height={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          autoCapitalize="none"
        />
      </div>

      {/* Filter */}
      <div className="seg" style={{ marginTop: 10 }}>
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

      {/* Students — unpaid first */}
      {visible === null ? (
        <ListSkeleton rows={4} />
      ) : visible.length === 0 ? (
        <div className="card empty">
          {students && students.length > 0 ? 'No students match.' : 'No students in this class yet.'}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
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
                <div className="s-sub">{s.phone}</div>
              </div>
              <div className="s-right">
                {s.batch_deleted ? (
                  <span className="badge deleted">Batch Deleted</span>
                ) : (
                  <StatusBadge status={s.status} />
                )}
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
