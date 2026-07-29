import { api } from './api'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Record a successful checkout on our backend. Razorpay has already captured the
 * money by the time its handler runs, so the payment is real — this call just
 * marks the month paid. On mobile UPI the phone switches to the payment app and
 * back, and iOS often kills the socket, so the first verify() can fail at the
 * network level. Retry those blips; a real rejection (bad signature, wrong
 * order) is NOT retried. If the network never recovers we return null and let
 * the Razorpay webhook (the authoritative backstop) record it server-side.
 */
async function verifyCheckout(resp) {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await api('/api/payments/verify', {
        method: 'POST',
        body: {
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
        },
      })
    } catch (err) {
      if (!err.network) throw err // genuine failure — surface it
      if (attempt === maxAttempts) return null // give up confirming; webhook covers it
      await sleep(1200 * attempt)
    }
  }
  return null
}

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
          const result = await verifyCheckout(resp)
          resolve({
            period: result?.period || order.period,
            amountPaise: order.amount_paise,
            paymentId: resp.razorpay_payment_id,
            // false = our verify call couldn't reach the server; the payment
            // still went through and the webhook will record it shortly.
            confirmed: Boolean(result),
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
