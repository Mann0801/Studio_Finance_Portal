import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../../context/AdminContext'
import { adminApi } from '../../lib/adminApi'
import { rupees } from '../../lib/batches'
import { useClasses } from '../../lib/classes'
import StatusBadge from '../../components/StatusBadge'
import { ArrowLeftIcon, EditIcon, PlusIcon, ChevronRightIcon } from '../../components/Icons'
import { CardSkeleton, Skeleton } from '../../components/Skeleton'

const fmtDate = (iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', opts) : '—'

/** A tappable summary row for one enrollment — full detail lives on its own
 * page (AdminEnrollmentDetail) so this profile stays short. */
function EnrollmentRow({ en, onOpen }) {
  return (
    <div
      className="list-item tappable"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(en.batch)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(en.batch)}
    >
      <div className="li-main">
        <div>{en.batch_label}</div>
        <div className="muted small">
          {en.slot_label}
          {en.batch_deleted ? (en.slot_label ? ' · ' : '') + 'Batch Deleted' : ''}
        </div>
      </div>
      <div className="s-right" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <span className={`s-amount ${en.status}`}>{rupees(en.amount_paise)}</span>
        <StatusBadge status={en.status} />
        <ChevronRightIcon width={18} height={18} style={{ color: 'var(--muted)' }} />
      </div>
    </div>
  )
}

/** Short student profile — quick facts + tappable rows into everything else
 * (per-class detail, edit, reset password) rather than one long scroll. */
export default function AdminStudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const { classes } = useClasses()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const load = useCallback(() => {
    adminApi(`/api/admin/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => load(), [load])

  const back = () => navigate(-1)

  const enrolledIds = useMemo(() => new Set((data?.enrollments ?? []).map((e) => e.batch)), [data])
  const hasAvailableClasses = useMemo(
    () => (classes ?? []).some((c) => !enrolledIds.has(c.id)),
    [classes, enrolledIds],
  )

  async function remove() {
    setBusy(true)
    try {
      await adminApi(`/api/admin/students/${id}`, { method: 'DELETE' })
      reloadStats()
      navigate('/admin/students', { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={back}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Student</h1>
        </div>
      </div>

      {!data ? (
        <>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '16px 0 8px' }}>
            <Skeleton height={84} width={84} radius={999} />
            <Skeleton height={22} width="55%" />
            <Skeleton height={14} width="40%" />
          </div>
          <CardSkeleton lines={3} />
          {error && <p className="error">{error}</p>}
        </>
      ) : (
        <>
          {/* Header */}
          <div className="profile-head">
            <div className="profile-avatar">{data.name.charAt(0).toUpperCase()}</div>
            <h2 className="profile-name">{data.name}</h2>
            <div className="muted">
              {data.enrollments.map((e) => e.batch_label).join(', ') || 'No classes'}
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          {/* Info */}
          <div className="card flush list" style={{ marginTop: 16 }}>
            <a className="list-item link-row" href={`tel:${data.phone}`}>
              <span className="muted">Phone</span>
              <span className="li-main accent">{data.phone}</span>
            </a>
            {data.email && (
              <a className="list-item link-row" href={`mailto:${data.email}`}>
                <span className="muted">Email</span>
                <span className="li-main accent" style={{ fontSize: 14 }}>{data.email}</span>
              </a>
            )}
            {data.signed_up_at && (
              <div className="list-item">
                <span className="muted">App Signup Date</span>
                <span className="li-main" style={{ fontSize: 14 }}>{fmtDate(data.signed_up_at)}</span>
              </div>
            )}
            <div className="list-item">
              <span className="muted">Total paid (all classes)</span>
              <span className="li-main">{rupees(data.total_paid_paise)}</span>
            </div>
          </div>

          {/* Classes — tap one for its own dues/history/actions */}
          <div className="section-h" style={{ marginTop: 20, marginBottom: 0 }}>
            <h2>Classes</h2>
          </div>
          <div className="card flush list" style={{ marginTop: 8 }}>
            {data.enrollments.map((en) => (
              <EnrollmentRow
                key={en.batch}
                en={en}
                onOpen={(batch) => navigate(`/admin/students/${id}/classes/${batch}`)}
              />
            ))}
          </div>

          {hasAvailableClasses && (
            <button
              className="btn ghost block"
              style={{ marginTop: 12 }}
              onClick={() => navigate(`/admin/students/${id}/add-class`)}
            >
              <PlusIcon width={16} height={16} /> Add a class
            </button>
          )}

          {/* Actions */}
          <div className="stack" style={{ marginTop: 20, gap: 10 }}>
            <button className="btn ghost block" onClick={() => navigate(`/admin/students/${id}/edit`)}>
              <EditIcon width={16} height={16} /> Edit name / phone
            </button>
            <button
              className="btn ghost block"
              onClick={() => navigate(`/admin/students/${id}/reset-password`)}
            >
              Reset password
            </button>

            {confirmRemove ? (
              <div className="card" style={{ borderColor: 'var(--unpaid)' }}>
                <p style={{ marginTop: 0 }}>
                  Remove <strong>{data.name}</strong>? This deletes their account and
                  payment history permanently, across every class.
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn danger block" onClick={remove} disabled={busy}>
                    {busy ? 'Removing…' : 'Yes, remove student'}
                  </button>
                  <button className="btn ghost block" onClick={() => setConfirmRemove(false)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn ghost block danger-text" onClick={() => setConfirmRemove(true)}>
                Remove student
              </button>
            )}
          </div>

          <div style={{ height: 28 }} />
        </>
      )}
    </>
  )
}
