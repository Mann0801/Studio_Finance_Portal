import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { payForMonth } from '../lib/razorpay'
import { useDashboard } from '../context/DashboardContext'

/* Shared "Pay Now" handler: opens Razorpay, and on success refreshes the
   dashboard and shows the success screen. Used by Home and Payments. */
export function usePayFlow() {
  const navigate = useNavigate()
  const { reload, data } = useDashboard()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function pay(period) {
    setError('')
    setPaying(true)
    try {
      const result = await payForMonth(period)
      await reload()
      navigate('/payment-success', {
        state: {
          ...result,
          studentName: data?.student?.name,
          batchLabel: data?.student?.batch_label,
          slotLabel: data?.student?.slot_label,
        },
        replace: true,
      })
    } catch (e) {
      // A user-dismissed checkout isn't an error worth shouting about.
      if (e.message !== 'Payment cancelled') setError(e.message)
    } finally {
      setPaying(false)
    }
  }

  return { pay, paying, error }
}
