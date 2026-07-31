import { rupees } from '../lib/batches'
import StatusBadge from './StatusBadge'

function periodLabel(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/* A full-size pay card for one unpaid month. Used for both the current month and
   any earlier overdue months, so every due month gets the same big Pay button.
   Older months render as "Overdue" so they read as the priority to clear. */
export default function DueCard({ month, isCurrent = false, paying, onPay, style }) {
  return (
    <div className="pay-card" style={style}>
      <div className="between">
        <span className="card-title">{periodLabel(month.period)}</span>
        <StatusBadge status={isCurrent ? 'unpaid' : 'overdue'} />
      </div>
      <div className="amount">{rupees(month.amount_paise)}</div>
      <div className="period">
        {month.paid_paise > 0 ? 'Balance due' : isCurrent ? 'Due this month' : 'Overdue'}
        {month.is_prorata ? ' · pro-rated' : ''}
      </div>
      {month.paid_paise > 0 && (
        <div className="part-paid">{rupees(month.paid_paise)} already paid in cash</div>
      )}
      <button
        className="btn primary lg block"
        style={{ marginTop: 18 }}
        onClick={() => onPay(month.period)}
        disabled={paying}
      >
        {paying ? 'Processing…' : `Pay ${rupees(month.amount_paise)} now`}
      </button>
    </div>
  )
}
