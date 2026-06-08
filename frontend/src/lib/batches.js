// Display-only batch metadata. The server is the source of truth for amounts;
// these prices are shown on the signup page for selection.
export const BATCHES = [
  { id: 'yoga', label: 'Yoga', monthly: 2500 },
  { id: 'zumba', label: 'Zumba', monthly: 2000 },
  { id: 'gymnastics', label: 'Gymnastics', monthly: 3000 },
]

export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`
