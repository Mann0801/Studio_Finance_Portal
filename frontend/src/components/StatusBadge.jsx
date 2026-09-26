const LABELS = { paid: 'Paid', overdue: 'Overdue', waived: 'Waived', package: 'Package', paused: 'Paused' }

export default function StatusBadge({ status, big = false }) {
  const cls = status in LABELS ? status : 'unpaid'
  const label = LABELS[status] || 'Unpaid'
  return <span className={`badge ${cls}${big ? ' big' : ''}`}>{label}</span>
}
