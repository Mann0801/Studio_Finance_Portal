import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { useClasses, scheduleLabel } from '../../lib/classes'
import { currentPeriod, shiftPeriod, periodLabel } from '../../lib/periods'
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

/** A class tile for the 2-up overview grid — name, schedule and student count. */
function ClassTile({ title, badge, subtitle, count, onClick }) {
  return (
    <button className="class-tile" onClick={onClick}>
      <div className="ct-name">{title}{badge}</div>
      {subtitle && <div className="ct-sched">{subtitle}</div>}
      <div className="ct-spacer" />
      <div className="ct-count">
        {count}
        <small>student{count === 1 ? '' : 's'}</small>
      </div>
    </button>
  )
}

/** A slot summary card (timing picker for classes with slots). */
function SlotCard({ title, subtitle, stat, onClick }) {
  const total = stat?.total_students ?? 0
  const paid = stat?.paid_count ?? 0
  const unpaid = stat?.unpaid_count ?? 0
  return (
    <button className="batch-card" onClick={onClick}>
      <div className="bc-main">
        <div className="bc-name">{title}</div>
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
  const CUR = currentPeriod()

  const [view, setView] = useState('batches') // 'batches' | 'slots' | 'students'
  const [activeBatch, setActiveBatch] = useState(null) // a per_batch entry
  const [activeSlot, setActiveSlot] = useState(null) // slot key | null
  const [period, setPeriod] = useState(CUR)
  const [students, setStudents] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const slotName = (batchId, key) =>
    clsMap.get(batchId)?.slots?.find((s) => s.key === key)?.name

  const fetchStudents = useCallback(
    (batchId, slotId, per) => {
      setStudents(null)
      const params = new URLSearchParams()
      if (slotId) params.set('slot', slotId)
      if (per) params.set('period', per)
      const q = params.toString()
      adminApi(`/api/admin/batches/${batchId}${q ? `?${q}` : ''}`).then(setStudents).catch(guard)
    },
    [guard],
  )

  const openStudents = (entry, slotId) => {
    setActiveBatch(entry)
    setActiveSlot(slotId)
    setSearch('')
    setFilter('all')
    setPeriod(CUR)
    setView('students')
    fetchStudents(entry.batch, slotId, CUR)
  }

  const openBatch = (entry) => {
    if (entry.slots?.length) {
      setActiveBatch(entry)
      setView('slots')
    } else {
      openStudents(entry, null)
    }
  }

  const changeMonth = (delta) => {
    const next = shiftPeriod(period, delta)
    if (next > CUR) return
    setPeriod(next)
    fetchStudents(activeBatch.batch, activeSlot, next)
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

  // ── Level 1: classes overview (2-up grid) ──────────────────────────────────
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
          <div className="class-grid">
            {perBatch.map((e) => {
              const cls = clsMap.get(e.batch)
              return (
                <ClassTile
                  key={e.batch}
                  title={e.batch_label}
                  badge={!cls ? <span className="mini-badge">Deleted</span> : null}
                  subtitle={cls ? scheduleLabel(cls) : 'Removed class'}
                  count={e.total_students}
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
            <SlotCard
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
  // Counts reflect the SELECTED month (derived from the fetched roster).
  const total = students?.length ?? 0
  const paidN = students ? students.filter((s) => s.status === 'paid').length : 0
  const unpaidN = total - paidN
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

      {/* Month selector — current month by default; step back for earlier months */}
      <div className="month-nav">
        <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
        <div className="month-nav-label">
          {periodLabel(period)}
          {period === CUR ? <span className="today-tag">This month</span> : null}
        </div>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} disabled={period >= CUR}>
          ›
        </button>
      </div>

      {/* Quick stats for the selected month */}
      <div className="stat-grid stat-grid-3" style={{ marginTop: 12 }}>
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
          {students && students.length > 0 ? 'No students match.' : 'No students in this class for this month.'}
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
