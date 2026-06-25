import { api } from './api'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'))
    document.body.appendChild(script)
  })
}

/**
 * Run the full pay flow for a period (default: current month):
 * create a server order -> open Razorpay Checkout -> verify the callback.
 *
 * The amount is server-computed and locked into the order — the checkout shows
 * it pre-filled and the student cannot change it. Resolves with
 * `{ period, amountPaise, paymentId }` on success; rejects on failure/dismissal.
 */
export async function payForMonth(period) {
  const order = await api('/api/payments/order', {
    method: 'POST',
    body: period ? { period } : {},
  })
  await loadCheckout()

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount_paise, // display only; the order is the source of truth
      currency: order.currency,
      name: order.studio_name || 'Studio',
      description: `Fee for ${order.period}`,
      prefill: {
        name: order.prefill_name,
        email: order.prefill_email,
        contact: order.prefill_contact,
      },
      theme: { color: '#3b82f6' },
      handler: async (resp) => {
        try {
          const result = await api('/api/payments/verify', {
            method: 'POST',
            body: {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          })
          resolve({
            period: result.period,
            amountPaise: order.amount_paise,
            paymentId: resp.razorpay_payment_id,
          })
        } catch (err) {
          reject(err)
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    })
    rzp.on('payment.failed', (resp) =>
      reject(new Error(resp.error?.description || 'Payment failed')),
    )
    rzp.open()
  })
}

// Back-compat alias.
export const payForCurrentMonth = () => payForMonth()
