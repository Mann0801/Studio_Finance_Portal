import { rupees } from '../lib/batches'

/** Per-class collection breakdown (with per-slot rows) — shared between the
 * Payments "By batch" tab and the "All payments" page. */
export default function BatchBreakdownList({ byBatch }) {
  if (byBatch.length === 0) {
    return <div className="card empty">No students due this month.</div>
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {byBatch.map((b) => (
        <div className="card" key={b.batch}>
          <div className="between">
            <strong>{b.batch_label}</strong>
            <span className="muted small">{b.paid}/{b.total} paid · {b.rate}%</span>
          </div>
          <div className="between" style={{ marginTop: 4 }}>
            <span className="muted small">{rupees(b.collected)} of {rupees(b.expected)}</span>
          </div>
          <div className="bar"><span style={{ width: `${Math.min(b.rate, 100)}%` }} /></div>

          {b.slots.length > 0 && (
            <div className="slot-breakdown">
              {b.slots.map((s) => (
                <div key={s.label} className="between slot-row">
                  <span className="muted small">{s.label}</span>
                  <span className="muted small">
                    {rupees(s.collected)} / {rupees(s.expected)} · {s.paid}/{s.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
