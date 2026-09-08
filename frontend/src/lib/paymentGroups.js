/** Collapse a month's payment rows into per-class collection totals, with a
 * per-slot breakdown for classes that have timing slots. Shared between the
 * Payments "By batch" tab and the "All payments" page so both stay in sync. */
export function groupByBatch(rows) {
  const map = new Map()
  for (const r of rows) {
    let g = map.get(r.batch)
    if (!g) {
      g = { batch: r.batch, batch_label: r.batch_label, total: 0, paid: 0, collected: 0, expected: 0, slots: new Map() }
      map.set(r.batch, g)
    }
    g.total += 1
    if (r.status === 'paid') g.paid += 1
    g.collected += r.paid_paise
    g.expected += r.due_paise
    if (r.slot_label) {
      let sg = g.slots.get(r.slot_label)
      if (!sg) { sg = { label: r.slot_label, total: 0, paid: 0, collected: 0, expected: 0 }; g.slots.set(r.slot_label, sg) }
      sg.total += 1
      if (r.status === 'paid') sg.paid += 1
      sg.collected += r.paid_paise
      sg.expected += r.due_paise
    }
  }
  const rate = (c, e) => (e > 0 ? Math.round((c / e) * 1000) / 10 : 0)
  return [...map.values()].map((g) => ({
    ...g,
    rate: rate(g.collected, g.expected),
    slots: [...g.slots.values()].map((s) => ({ ...s })),
  }))
}
