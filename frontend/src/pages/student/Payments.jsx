import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import StatusBadge from '../../components/StatusBadge'
import DueCard from '../../components/DueCard'
import ClassSwitcher from '../../components/ClassSwitcher'
import { DownloadIcon, CashIcon } from '../../components/Icons'
import { CardSkeleton, ListSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Payments() {
  const { data, loading, error, activeEnrollment, activeClassId, setActiveClassId } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()
  const navigate = useNavigate()

  const enrollments = data?.enrollments ?? []
  const en = activeEnrollment

  // History shows every month money was received — including partial cash on a
  // month still being cleared (it also appears above as a balance to pay).
  const historyRows = en?.history ?? []
  // Oldest overdue month first (top priority); `outstanding` is newest→oldest.
  const overdue = [...(en?.outstanding ?? [])].reverse()

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Payments</h1>
          {en && <div className="hello" style={{ marginTop: 4 }}>{en.batch_label}</div>}
        </div>
      </div>

      {enrollments.length > 1 && (
        <ClassSwitcher enrollments={enrollments} activeId={activeClassId} onChange={setActiveClassId} />
      )}

      {loading && (
        <>
          <CardSkeleton lines={1} />
          <div style={{ height: 20 }} />
          <ListSkeleton rows={3} />
        </>
      )}
      {error && <p className="error">{error}</p>}

      {en && (en.fee_type === 'enquiry' || en.batch_deleted) ? (
        <div className="card">
          <span className="card-title">
            {en.batch_deleted ? 'Class no longer available' : 'Arranged with the studio'}
          </span>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {en.batch_deleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class has no online payment. Contact the studio to arrange your membership.'}
          </p>
        </div>
      ) : en ? (
        <>
          {/* Overdue earlier months first (top priority), then the current month —
              each as a full pay card with its own big Pay button. */}
          {overdue.map((m, i) => (
            <DueCard
              key={m.period}
              month={m}
              paying={paying}
              onPay={(period) => pay(period, en.batch)}
              style={i > 0 ? { marginTop: 12 } : undefined}
            />
          ))}

          <div className="pay-card" style={overdue.length ? { marginTop: 12 } : undefined}>
            <div className="between">
              <span className="card-title">
                {en.current.status === 'paid' ? 'Paid this month' : 'Due this month'}
              </span>
              <StatusBadge status={en.current.status} />
            </div>
            <div className="amount">{rupees(en.current.amount_paise)}</div>
            <div className="period">
              {periodLabel(en.current.period)}
              {en.current.is_prorata ? ' · pro-rated' : ''}
            </div>
            {en.current.status !== 'paid' && en.current.paid_paise > 0 && (
              <div className="part-paid">{rupees(en.current.paid_paise)} already paid</div>
            )}
            {en.current.status !== 'paid' && en.current.amount_paise > 0 && (
              <button
                className="btn primary lg block"
                style={{ marginTop: 18 }}
                onClick={() => pay(undefined, en.batch)}
                disabled={paying}
              >
                {paying ? 'Processing…' : `Pay ${rupees(en.current.amount_paise)} now`}
              </button>
            )}
            {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
          </div>

          <div className="section-h" style={{ marginTop: 22 }}>
            <h2>History</h2>
          </div>
          {historyRows.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="card flush">
              <div className="data-row head">
                <span>Month</span>
                <span>Paid via</span>
                <span style={{ textAlign: 'right' }}>Amount</span>
              </div>
              {historyRows.map((p) => (
                <div className="data-row static" key={p.period}>
                  <span className="data-name">{periodLabel(p.period)}</span>
                  <span className="data-sub">
                    {p.is_prorata ? 'Pro-rated · ' : ''}
                    {p.method !== 'Online' && <CashIcon width={12} height={12} className="cash-ico" />}
                    {p.method}
                    {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString('en-IN')}` : ''}
                  </span>
                  <div className="data-end">
                    <div
                      style={{
                        color: p.status === 'paid' ? 'var(--paid)' : 'var(--warn)',
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {rupees(p.paid_paise)}
                    </div>
                    {p.status === 'paid' ? (
                      <button
                        type="button"
                        className="link-btn receipt-link"
                        style={{ marginTop: 4 }}
                        onClick={() => navigate(`/receipt/${en.batch}/${p.period}`)}
                      >
                        <DownloadIcon width={14} height={14} /> Receipt
                      </button>
                    ) : (
                      <div style={{ color: 'var(--warn)', fontWeight: 700, marginTop: 4 }}>partial</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  )
}
