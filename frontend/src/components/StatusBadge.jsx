export default function StatusBadge({ status, big = false }) {
  const paid = status === 'paid'
  return (
    <span className={`badge ${paid ? 'paid' : 'unpaid'}${big ? ' big' : ''}`}>
      {paid ? 'Paid' : 'Unpaid'}
    </span>
  )
}
