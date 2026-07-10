// Display-only batch metadata. The server is the source of truth for amounts;
// these prices/schedules are shown on the signup page for selection. `id` values
// must match the backend Batch enum.
export const BATCHES = [
  {
    id: 'senior_citizens_yoga',
    label: 'Senior Citizens Yoga',
    schedule: 'Mon to Fri · 5:45–6:30 AM',
    price: '₹2,000/month',
  },
  {
    id: 'traditional_yoga',
    label: 'Traditional Yoga',
    schedule: 'Mon to Fri',
    price: '₹2,300/month',
    hasSlots: true,
  },
  {
    id: 'weight_loss_yoga',
    label: 'Weight Loss Yoga',
    schedule: 'Mon to Fri · 6:00–7:00 PM',
    price: '₹3,000/month',
  },
  {
    id: 'prenatal_yoga',
    label: 'Prenatal Yoga',
    schedule: 'Sat & Sun',
    price: '₹1,000/session',
  },
  {
    id: 'gymnastics',
    label: 'Gymnastics',
    schedule: 'Tue & Sun · 8 classes/month',
    price: '₹2,800/month',
  },
  {
    id: 'zumba',
    label: 'Zumba',
    schedule: 'Sat & Sun · 8 classes/month',
    price: '₹2,000/month',
  },
  {
    id: 'kids_yoga',
    label: 'Kids Yoga',
    schedule: '',
    price: '₹2,000/month',
  },
  // TEMP: for verifying live payments end-to-end. Remove after testing.
  {
    id: 'test_course',
    label: 'Test Course',
    schedule: 'Test only — verifies live payments',
    price: '₹10',
  },
]

// Traditional Yoga timing slots. `id` values must match the backend.
export const TRADITIONAL_SLOTS = [
  { id: 'batch1', label: 'Batch 1', time: '6:30 AM – 7:30 AM' },
  { id: 'batch2', label: 'Batch 2', time: '7:30 AM – 8:30 AM' },
  { id: 'batch3', label: 'Batch 3', time: '8:30 AM – 9:30 AM' },
  { id: 'batch4', label: 'Batch 4', time: '5:00 PM – 6:00 PM' },
]

export const batchById = (id) => BATCHES.find((b) => b.id === id)
export const slotById = (id) => TRADITIONAL_SLOTS.find((s) => s.id === id)
export const slotLabel = (id) => {
  const s = slotById(id)
  return s ? `${s.label} · ${s.time}` : ''
}

export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`
