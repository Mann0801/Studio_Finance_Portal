import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, clearAdminToken } from '../../lib/adminApi'
import { BATCHES, rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import { WhatsAppIcon, MegaphoneIcon } from '../../components/Icons'
import { Skeleton, ListSkeleton } from '../../components/Skeleton'

function pct(n) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

// ── Announcement manager ──
function AnnouncementManager() {
  const [ann, setAnn] = useState(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi('/api/admin/announcement').then(setAnn).catch(() => {})
  }, [])
  useEffect(() => load(), [load])

  async function save() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const saved = await adminApi('/api/admin/announcement', {
        method: ann ? 'PUT' : 'POST',
        body: { message: text.trim() },
      })
      setAnn(saved)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await adminApi('/api/admin/announcement', { method: 'DELETE' })
      setAnn(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="between" style={{ marginBottom: ann ? 12 : 0 }}>
        <div className="row" style={{ gap: 10 }}>
          <MegaphoneIcon width={20} height={20} style={{ color: 'var(--accent-bright)' }} />
          <strong>Announcement</strong>
        </div>
        <button
          className="btn"
          style={{ minHeight: 40, padding: '0 14px' }}
          onClick={() => {
            setText(ann?.message || '')
            setEditing(true)
          }}
        >
          {ann ? 'Edit' : 'Post'}
        </button>
      </div>
      {ann ? (
        <>
          <p className="muted" style={{ fontSize: 14 }}>{ann.message}</p>
          <button className="link-btn" style={{ color: 'var(--unpaid)', marginTop: 8, paddingLeft: 0 }} onClick={remove} disabled={busy}>
            Remove
          </button>
        </>
      ) : (
        <p className="muted small" style={{ marginTop: 6 }}>No active announcement.</p>
      )}

      {editing && (
        <div className="sheet-backdrop" onClick={() => setEditing(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 12 }}>{ann ? 'Edit' : 'New'} announcement</h2>
            <textarea
              value={text}
              maxLength={500}
              placeholder="e.g. Studio closed on 26th for maintenance."
              onChange={(e) => setText(e.target.value)}
            />
            <div className="stack" style={{ marginTop: 14 }}>
              <button className="btn primary block" onClick={save} disabled={busy || !text.trim()}>
                {busy ? 'Saving…' : 'Publish to all students'}
              </button>
              <button className="btn ghost block" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [batch, setBatch] = useState('yoga')
  const [stats, setStats] = useState(null)
  const [students, setStudents] = useState(null)
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

  const selectBatch = (id) => {
    if (id === batch) return
    setStudents(null) // show skeleton while the new batch loads
    setBatch(id)
  }

  return (
    <div className="app-shell">
      <div className="page">
        <div className="topbar">
          <div className="greeting">
            <div className="hello">Admin console</div>
            <h1>Overview</h1>
          </div>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>

        {/* Stats strip */}
        {!stats ? (
          <div className="stat-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="stat" key={i}>
                <Skeleton height={26} width="55%" />
                <Skeleton height={13} width="75%" style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="stat-grid">
            <div className="stat">
              <div className="num">{stats.total_students}</div>
              <div className="label">Total students</div>
            </div>
            <div className="stat">
              <div className="num">{rupees(stats.revenue_paise)}</div>
              <div className="label">Revenue this month</div>
              <div className={`delta ${stats.revenue_change_pct >= 0 ? 'up' : 'down'}`}>
                {pct(stats.revenue_change_pct)} vs last month
              </div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: 'var(--paid)' }}>{stats.paid_count}</div>
              <div className="label">Paid</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: 'var(--unpaid)' }}>{stats.unpaid_count}</div>
              <div className="label">Unpaid</div>
            </div>
          </div>
        )}

        {/* Revenue analytics */}
        {stats && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="between" style={{ marginBottom: 6 }}>
              <strong>Revenue analytics</strong>
              <span className="muted small">{stats.period}</span>
            </div>
            <div className="analytics-row">
              <span className="muted">Last month</span>
              <strong>{rupees(stats.last_month_revenue_paise)}</strong>
            </div>
            <div className="analytics-row">
              <span className="muted">Collected / expected</span>
              <strong>
                {rupees(stats.revenue_paise)} / {rupees(stats.expected_paise)}
              </strong>
            </div>
            <div style={{ paddingTop: 12 }}>
              <div className="between">
                <span className="muted small">Overall collection rate</span>
                <strong className="small">{stats.collection_rate}%</strong>
              </div>
              <div className="bar"><span style={{ width: `${Math.min(stats.collection_rate, 100)}%` }} /></div>
            </div>

            {/* Per-batch */}
            <div style={{ marginTop: 16 }}>
              {stats.per_batch.map((b) => (
                <div key={b.batch} style={{ padding: '10px 0', borderTop: '1px solid var(--border-soft)' }}>
                  <div className="between">
                    <strong>{b.batch_label}</strong>
                    <span className="muted small">
                      {b.paid_count}/{b.total_students} paid · {b.collection_rate}%
                    </span>
                  </div>
                  <div className="between" style={{ marginTop: 4 }}>
                    <span className="muted small">{rupees(b.revenue_paise)} of {rupees(b.expected_paise)}</span>
                  </div>
                  <div className="bar"><span style={{ width: `${Math.min(b.collection_rate, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcement */}
        <div style={{ marginTop: 16 }}>
          <AnnouncementManager />
        </div>

        {/* Batch chips */}
        <div className="section-h" style={{ marginTop: 20, marginBottom: 4 }}>
          <h2>Students</h2>
        </div>
        <div className="chips">
          {BATCHES.map((b) => (
            <button
              key={b.id}
              className={`chip ${batch === b.id ? 'active' : ''}`}
              onClick={() => selectBatch(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        {/* Student cards */}
        {students === null ? (
          <ListSkeleton rows={4} />
        ) : students.length === 0 ? (
          <div className="card empty">No students in this batch yet.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {students.map((s) => (
              <div className="student-card" key={s.id}>
                <div className="avatar">{s.name.charAt(0).toUpperCase()}</div>
                <div className="s-info">
                  <div className="s-name">{s.name}</div>
                  <div className="s-sub">{rupees(s.amount_paise)} · {s.phone}</div>
                </div>
                <div className="s-right">
                  <StatusBadge status={s.status} />
                  {s.whatsapp_url && (
                    <a className="wa-btn" href={s.whatsapp_url} target="_blank" rel="noreferrer">
                      <WhatsAppIcon width={16} height={16} /> Remind
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 28 }} />
      </div>
    </div>
  )
}
