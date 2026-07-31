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

/** Full page to record a cash payment (full or partial) for one month. */
export default function AdminRecordCash() {
  const { id, period } = useParams()
  const navigate = useNavigate()
  const { reloadStats } = useAdmin()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')

  const load = useCallback(() => {
    adminApi(`/api/admin/students/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [id])
  useEffect(() => load(), [load])

  const back = () => navigate(`/admin/students/${id}`)

  // Remaining balance + how much is already paid for this month.
  const forThisMonth = data && period === data.period
  const outstandingRow = data?.outstanding?.find((x) => x.period === period)
  const remaining = forThisMonth
    ? data.status !== 'paid'
      ? data.amount_paise
      : 0
    : outstandingRow?.amount_paise || 0
  const alreadyPaid = forThisMonth ? data?.paid_paise || 0 : outstandingRow?.paid_paise || 0

  async function record(amountPaise) {
    setBusy(true)
    setError('')
    try {
      const body = { period }
      if (amountPaise != null) body.amount_paise = amountPaise
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
          <h1>Record cash</h1>
        </div>
      </div>

      {!data && !error && <CardSkeleton lines={2} />}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="card">
            <div className="muted small">{data.name}</div>
            <div className="card-title" style={{ marginTop: 2 }}>{periodLabel(period)}</div>
            {remaining > 0 ? (
              <>
                <div className="muted small" style={{ marginTop: 10 }}>Balance owed</div>
                <div className="amount" style={{ fontSize: 30 }}>{rupees(remaining)}</div>
                {alreadyPaid > 0 && (
                  <div className="part-paid">{rupees(alreadyPaid)} already paid in cash</div>
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
              <button
                className="btn primary lg block"
                style={{ marginTop: 16 }}
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
