import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { formatPhoneDisplay } from '../../lib/auth'
import { ArrowLeftIcon, TrashIcon } from '../../components/Icons'
import { ListSkeleton } from '../../components/Skeleton'

function dateLabel(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Matches the server's session_date format (YYYY-MM-DD), computed in the same
// timezone the rest of the admin console uses for dates.
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

/** Every self-reported attendance mark for a PER_SESSION class this month —
 * lets the admin mark a student's attendance themselves (e.g. they forgot to
 * self-report) or undo a mistaken tap (double-tap, wrong day). Reached from
 * the class detail page. */
export default function AdminAttendanceLog() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { guard } = useAdmin()
  const [rows, setRows] = useState(null)
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    adminApi(`/api/admin/classes/${id}/attendance`).then(setRows).catch(guard)
    adminApi(`/api/admin/batches/${id}`).then(setRoster).catch(guard)
  }, [id, guard])
  useEffect(() => load(), [load])

  const today = todayIST()
  const markedTodayIds = new Set((rows || []).filter((r) => r.session_date === today).map((r) => r.student_id))

  async function markForStudent(studentId) {
    setBusyId(studentId)
    setError('')
    try {
      const updated = await adminApi(`/api/admin/classes/${id}/attendance/${studentId}`, { method: 'POST' })
      setRows(updated)
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function undo(attendanceId) {
    setBusyId(attendanceId)
    setError('')
    try {
      const updated = await adminApi(`/api/admin/classes/${id}/attendance/${attendanceId}`, { method: 'DELETE' })
      setRows(updated)
    } catch (err) {
      if (/expired|log in/i.test(err.message)) guard(err)
      else setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Attendance</h1>
          <div className="hello" style={{ marginTop: 2 }}>This month</div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="section-h" style={{ marginTop: 0, marginBottom: 0 }}>
        <h2>Mark today's session</h2>
      </div>
      {roster === null ? (
        <ListSkeleton rows={2} />
      ) : roster.length === 0 ? (
        <div className="card empty">No students in this class.</div>
      ) : (
        <div className="card flush" style={{ marginTop: 8, marginBottom: 20 }}>
          {roster.map((s, i) => {
            const done = markedTodayIds.has(s.id)
            return (
              <div className="record-row" key={s.id}>
                <div className="record-num">{i + 1}</div>
                <div className="record-body">
                  <div className="record-name">{s.name}</div>
                  <div className="record-fields">
                    <span><b>Phone</b> {formatPhoneDisplay(s.phone)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn sm ${done ? 'ghost' : 'primary'}`}
                  style={{ flex: 'none', alignSelf: 'center' }}
                  onClick={() => markForStudent(s.id)}
                  disabled={done || busyId === s.id}
                >
                  {done ? '✓ Marked' : busyId === s.id ? 'Marking…' : 'Mark today'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="section-h" style={{ marginTop: 4, marginBottom: 0 }}>
        <h2>This month's log</h2>
      </div>
      {rows === null ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="card empty">No one has marked attendance yet this month.</div>
      ) : (
        <div className="card flush">
          {rows.map((r, i) => (
            <div className="record-row" key={r.id}>
              <div className="record-num">{i + 1}</div>
              <div className="record-body">
                <div className="record-name">{r.name}</div>
                <div className="record-fields">
                  <span><b>Phone</b> {formatPhoneDisplay(r.phone)}</span>
                  <span><b>Date</b> {dateLabel(r.session_date)}</span>
                  <span><b>Marked by</b> {r.marked_by === 'admin' ? 'Admin' : 'Student'}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn ghost sm danger-text"
                style={{ flex: 'none', alignSelf: 'center' }}
                onClick={() => undo(r.id)}
                disabled={busyId === r.id}
              >
                <TrashIcon width={14} height={14} /> {busyId === r.id ? 'Removing…' : 'Undo'}
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
