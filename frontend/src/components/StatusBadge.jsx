export default function StatusBadge({ status, big = false }) {
  const cls = status === 'paid' ? 'paid' : status === 'overdue' ? 'overdue' : 'unpaid'
  const label = status === 'paid' ? 'Paid' : status === 'overdue' ? 'Overdue' : 'Unpaid'
  return <span className={`badge ${cls}${big ? ' big' : ''}`}>{label}</span>
}
