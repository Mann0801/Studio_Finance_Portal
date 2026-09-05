import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '../../lib/adminApi'
import { useAdmin } from '../../context/AdminContext'
import { rupees } from '../../lib/batches'
import { ArrowLeftIcon } from '../../components/Icons'
import { CardSkeleton } from '../../components/Skeleton'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** Full page to record a cash payment (full or partial) for one class's month. */
export default function AdminRecordCash() {
  const { id, batch, period } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')
  const [methodNote, setMethodNote] = useState('')

  const load = useCallback(() => {
    adminApi(`/api/admin/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [id])
  useEffect(() => load(), [load])

  const back = () => navigate(`/admin/students/${id}`)

  const enrollment = data?.enrollments?.find((e) => e.batch === batch)

  // Remaining balance + how much is already paid for this month.
  const forThisMonth = enrollment && period === enrollment.period
  const outstandingRow = enrollment?.outstanding?.find((x) => x.period === period)
  const remaining = forThisMonth
    ? enrollment.status !== 'paid'
      ? enrollment.amount_paise
      : 0
    : outstandingRow?.amount_paise || 0
  const alreadyPaid = forThisMonth ? enrollment?.paid_paise || 0 : outstandingRow?.paid_paise || 0

  async function record(amountPaise) {
    setBusy(true)
    setError('')
    try {
      const body = { batch, period }
      if (amountPaise != null) body.amount_paise = amountPaise
      if (methodNote.trim()) body.method = methodNote.trim()
      await adminApi(`/api/admin/students/${id}/mark-paid`, { method: 'POST', body })
      reloadStats()
      navigate(`/admin/students/${id}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const paise = Math.round(Number(custom) * 100)
  const validCustom = custom !== '' && paise >= 1 && paise <= remaining

  return (
    <>
      <div className="topbar with-back">
        <button className="back-btn" aria-label="Back" onClick={back}>
          <ArrowLeftIcon width={22} height={22} />
        </button>
        <div className="greeting">
          <h1>Record payment</h1>
        </div>
      </div>

      {!data && !error && <CardSkeleton lines={2} />}
      {error && <p className="error">{error}</p>}

      {data && enrollment && (
        <>
          <div className="card">
            <div className="muted small">{data.name} · {enrollment.batch_label}</div>
            <div className="card-title" style={{ marginTop: 2 }}>{periodLabel(period)}</div>
            {remaining > 0 ? (
              <>
                <div className="muted small" style={{ marginTop: 10 }}>Balance owed</div>
                <div className="amount" style={{ fontSize: 30 }}>{rupees(remaining)}</div>
                {alreadyPaid > 0 && (
                  <div className="part-paid">{rupees(alreadyPaid)} already paid</div>
                )}
              </>
            ) : (
              <p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
                This month has nothing outstanding to record.
              </p>
            )}
          </div>

          {remaining > 0 && (
            <>
              <div className="form" style={{ marginTop: 16 }}>
                <label>
                  Payment type <span className="muted small">(optional — e.g. GPay, Cash, Netbanking)</span>
                  <input
                    type="text"
                    value={methodNote}
                    onChange={(e) => setMethodNote(e.target.value)}
                    placeholder="Cash"
                    maxLength={40}
                  />
                </label>
              </div>

              <button
                className="btn primary lg block"
                style={{ marginTop: 10 }}
                onClick={() => record(null)}
                disabled={busy}
              >
                {busy ? 'Saving…' : `Record full ${rupees(remaining)} paid`}
              </button>

              <div className="pay-or">or record a part payment</div>

              <div className="form">
                <label>
                  Amount received (₹)
                  <input
                    type="number"
                    inputMode="numeric"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder={`up to ${remaining / 100}`}
                    min="1"
                    max={remaining / 100}
                    autoFocus
                  />
                </label>
              </div>
              <button
                className="btn ghost block"
                style={{ marginTop: 10 }}
                disabled={busy || !validCustom}
                onClick={() => record(paise)}
              >
                {validCustom && paise < remaining
                  ? `Save ${rupees(paise)} — leaves ${rupees(remaining - paise)}`
                  : 'Save part payment'}
              </button>
            </>
          )}
        </>
      )}
    </>
  )
}
