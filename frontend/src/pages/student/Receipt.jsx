import { useNavigate, useParams } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { rupees } from '../../lib/batches'
import { LOGO_SRC, STUDIO_NAME } from '../../lib/brand'
import { BUSINESS } from '../../lib/business'
import { ArrowLeftIcon, DownloadIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function Receipt() {
  const { period } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useDashboard()

  const payment = data?.history?.find((p) => p.period === period && p.status === 'paid')

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={() => navigate('/payments')}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Receipt</h1>
        </div>
      </div>

      {loading ? (
        <CardSkeleton lines={4} />
      ) : !payment ? (
        <div className="card empty">Receipt not found.</div>
      ) : (
        <>
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
              <div className="receipt-row"><span className="muted">Month</span><span>{periodLabel(payment.period)}</span></div>
              <div className="receipt-row"><span className="muted">Paid on</span><span>{fmtDate(payment.paid_at)}</span></div>
              <div className="receipt-row total"><span>Amount paid</span><span>{rupees(payment.amount_paise)}</span></div>
            </div>
            <div className="muted small" style={{ textAlign: 'center', marginTop: 12 }}>
              Thank you! · {BUSINESS.name}
            </div>
          </div>

          <button className="btn primary lg block" style={{ marginTop: 16 }} onClick={() => window.print()}>
            <DownloadIcon width={18} height={18} /> Download / Print
          </button>
        </>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
