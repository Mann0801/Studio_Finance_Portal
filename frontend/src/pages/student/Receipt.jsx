import { useState } from 'react'
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

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
  return `${date}, ${time}`
}

export default function Receipt() {
  const { batch, period } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useDashboard()
  const [downloading, setDownloading] = useState(false)

  const enrollment = data?.enrollments?.find((e) => e.batch === batch)
  const payment = enrollment?.history?.find((p) => p.period === period && p.status === 'paid')

  // Renders the on-screen receipt to an image, then wraps that image in a
  // one-page PDF and saves it directly — skips the browser's print dialog,
  // which was the only way to "download" before. Forced to a plain white/
  // black look in the cloned copy (the on-screen version is dark-themed to
  // match the rest of the app) so the saved file reads like a normal
  // receipt, not a screenshot of a dark app.
  async function downloadReceipt() {
    setDownloading(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(document.getElementById('receipt-doc'), {
        backgroundColor: '#ffffff',
        scale: 2,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('receipt-doc')
          if (!el) return
          el.style.background = '#ffffff'
          el.style.color = '#111111'
          el.style.border = 'none'
          el.querySelectorAll('.muted').forEach((m) => {
            m.style.color = '#555555'
          })
        },
      })
      // Page sized to the receipt's own aspect ratio (mm = px at 96dpi / 3.7795)
      // so it isn't stranded in the corner of a full A4 sheet.
      const widthMm = canvas.width / 3.7795
      const heightMm = canvas.height / 3.7795
      const pdf = new jsPDF({
        orientation: widthMm > heightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
      })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm)
      pdf.save(`${STUDIO_NAME} - ${periodLabel(payment.period)} Receipt.pdf`)
    } finally {
      setDownloading(false)
    }
  }

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
                <span>{enrollment.batch_label}{enrollment.slot_label ? ` · ${enrollment.slot_label}` : ''}</span>
              </div>
              <div className="receipt-row"><span className="muted">Month</span><span>{periodLabel(payment.period)}</span></div>
              <div className="receipt-row"><span className="muted">Paid on</span><span>{fmtDateTime(payment.paid_at)}</span></div>
              <div className="receipt-row total"><span>Amount paid</span><span>{rupees(payment.amount_paise)}</span></div>
            </div>
            <div className="muted small" style={{ textAlign: 'center', marginTop: 12 }}>
              Thank you! · {BUSINESS.name}
            </div>
          </div>

          <button
            className="btn primary lg block"
            style={{ marginTop: 16 }}
            onClick={downloadReceipt}
            disabled={downloading}
          >
            <DownloadIcon width={18} height={18} /> {downloading ? 'Preparing…' : 'Download Receipt'}
          </button>
        </>
      )}
      <div style={{ height: 28 }} />
    </>
  )
}
