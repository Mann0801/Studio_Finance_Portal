import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { formatPhoneDisplay } from '../../lib/auth'
import { ArrowLeftIcon, ChevronRightIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

/** Hub for editing profile fields — each row opens its own dedicated page and
 * returns here once saved, instead of one long combined form. */
export default function EditProfile() {
  const { data, loading } = useDashboard()
  const navigate = useNavigate()

  const rows = data
    ? [
        { label: 'Name', value: data.student.name, to: '/profile/edit/name' },
        { label: 'Phone number', value: formatPhoneDisplay(data.student.phone), to: '/profile/edit/phone' },
        { label: 'Recovery email', value: data.student.email || 'Not added', to: '/profile/edit/email' },
        { label: 'Change password', value: '••••••••', to: '/profile/edit/password' },
      ]
    : []

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Edit profile</h1>
        </div>
      </div>

      {loading ? (
        <CardSkeleton lines={4} />
      ) : (
        <div className="card flush list" style={{ marginTop: 8 }}>
          {rows.map((r) => (
            <div
              key={r.to}
              className="list-item link-row"
              role="button"
              tabIndex={0}
              onClick={() => navigate(r.to)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(r.to)}
            >
              <span className="muted">{r.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="li-main" style={{ fontSize: 14 }}>{r.value}</span>
                <ChevronRightIcon width={16} height={16} style={{ color: 'var(--muted)' }} />
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
