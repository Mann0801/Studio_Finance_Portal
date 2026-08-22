import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { payForMonth } from '../lib/razorpay'
import { useDashboard } from '../context/DashboardContext'

/* Shared "Pay Now" handler: opens Razorpay for one class's month, and on
   success refreshes the dashboard and shows the success screen. Used by Home
   and Payments. `batch` defaults to the currently active class. */
export function usePayFlow() {
  const navigate = useNavigate()
  const { reload, data, activeClassId } = useDashboard()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function pay(period, batch = activeClassId) {
    setError('')
    setPaying(true)
    try {
      const result = await payForMonth(period, batch)
      await reload()
      // If the client couldn't confirm the payment (mobile network blip after
      // UPI), the Razorpay webhook records it server-side a moment later — keep
      // refreshing in the background so Home/Payments flip to Paid on their own.
      if (!result.confirmed) {
        ;(async () => {
          for (let i = 0; i < 4; i++) {
            await new Promise((r) => setTimeout(r, 2500))
            await reload()
          }
        })()
      }
      navigate('/payment-success', {
        state: {
          ...result,
          studentName: data?.student?.name,
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
