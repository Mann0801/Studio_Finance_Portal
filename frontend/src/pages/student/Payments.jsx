import { useState } from 'react'
import { useDashboard } from '../../context/DashboardContext'
import { usePayFlow } from '../../hooks/usePayFlow'
import { rupees } from '../../lib/batches'
import { LOGO_SRC, STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
import StatusBadge from '../../components/StatusBadge'
import { CardSkeleton, ListSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function Payments() {
  const { data, loading, error } = useDashboard()
  const { pay, paying, error: payError } = usePayFlow()
  const [receiptFor, setReceiptFor] = useState(null)

  // Months surfaced above as payable dues shouldn't also appear as "Pending"
  // rows in History (they'd be the same month listed twice).
  const outstandingPeriods = new Set((data?.outstanding ?? []).map((p) => p.period))
  const historyRows = (data?.history ?? []).filter((p) => !outstandingPeriods.has(p.period))

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Payments</h1>
        </div>
      </div>

      {loading && (
        <>
          <CardSkeleton lines={1} />
          <div style={{ height: 20 }} />
          <ListSkeleton rows={3} />
        </>
      )}
      {error && <p className="error">{error}</p>}

      {data && (data.student.fee_type === 'enquiry' || data.student.batch_deleted) ? (
        <div className="card">
          <span className="card-title">
            {data.student.batch_deleted ? 'Class no longer available' : 'Arranged with the studio'}
          </span>
          <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
            {data.student.batch_deleted
              ? 'Your class was removed. Please contact the studio to be moved to another class.'
              : 'This class has no online payment. Contact the studio to arrange your membership.'}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="pay-card">
            <div className="between">
              <span className="card-title">
                {data.current.status === 'paid' ? 'Paid this month' : 'Due this month'}
              </span>
              <StatusBadge status={data.current.status} />
            </div>
            <div className="amount">{rupees(data.current.amount_paise)}</div>
            <div className="period">
              {periodLabel(data.current.period)}
              {data.current.is_prorata ? ' · pro-rated' : ''}
            </div>
            {data.current.status !== 'paid' && data.current.amount_paise > 0 && (
              <button
                className="btn primary lg block"
                style={{ marginTop: 18 }}
                onClick={() => pay()}
                disabled={paying}
              >
                {paying ? 'Processing…' : `Pay ${rupees(data.current.amount_paise)} now`}
              </button>
            )}
            {payError && <p className="error" style={{ marginTop: 12 }}>{payError}</p>}
          </div>

          {data.outstanding?.length > 0 && (
            <>
              <div className="section-h" style={{ marginTop: 22 }}>
                <h2>Earlier months due</h2>
              </div>
              <div className="card flush list">
                {data.outstanding.map((p) => (
                  <div className="list-item" key={p.period}>
                    <div>
                      <div className="li-main">{periodLabel(p.period)}</div>
                      <div className="li-sub">
                        {p.is_prorata ? 'Pro-rated · ' : ''}Unpaid
                      </div>
                    </div>
                    <button
                      className="btn primary sm"
                      onClick={() => pay(p.period)}
                      disabled={paying}
                    >
                      {paying ? '…' : `Pay ${rupees(p.amount_paise)}`}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-h" style={{ marginTop: 22 }}>
            <h2>History</h2>
          </div>
          {historyRows.length === 0 ? (
            <div className="card empty">No payments yet.</div>
          ) : (
            <div className="card flush list">
              {historyRows.map((p) => (
                <div className="list-item" key={p.period}>
                  <div>
                    <div className="li-main">{periodLabel(p.period)}</div>
                    <div className="li-sub">
                      {p.is_prorata ? 'Pro-rated · ' : ''}
                      {p.paid_at ? `Paid ${new Date(p.paid_at).toLocaleDateString('en-IN')}` : 'Pending'}
                    </div>
                  </div>
                  <div className="s-right" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <span className="li-amt">{rupees(p.amount_paise)}</span>
                    {p.status === 'paid' ? (
                      <button type="button" className="link-btn" onClick={() => setReceiptFor(p)}>
                        Receipt
                      </button>
                    ) : (
                      <StatusBadge status={p.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {receiptFor && data && (
        <div className="sheet-backdrop" onClick={() => setReceiptFor(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div id="receipt-doc" className="receipt-doc">
              <div className="receipt-head">
                <img src={LOGO_SRC} alt="" className="receipt-logo" />
                <div>
                  <div className="receipt-studio">{STUDIO_NAME}</div>
                  <div className="muted small">Fee receipt</div>
                </div>
              </div>
              <div className="receipt-rows">
                <div className="receipt-row"><span className="muted">Student</span><span>{data.student.name}</span></div>
                <div className="receipt-row">
                  <span className="muted">Class</span>
                  <span>{data.student.batch_label}{data.student.slot_label ? ` · ${data.student.slot_label}` : ''}</span>
                </div>
                <div className="receipt-row"><span className="muted">Month</span><span>{periodLabel(receiptFor.period)}</span></div>
                <div className="receipt-row"><span className="muted">Paid on</span><span>{fmtDate(receiptFor.paid_at)}</span></div>
                <div className="receipt-row total"><span>Amount paid</span><span>{rupees(receiptFor.amount_paise)}</span></div>
              </div>
              <div className="muted small" style={{ textAlign: 'center', marginTop: 12 }}>
                Thank you! · {BUSINESS.name}
              </div>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn primary block" onClick={() => window.print()}>Download / Print</button>
              <button className="btn ghost block" onClick={() => setReceiptFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
