import LegalPage from './LegalPage'
import { BUSINESS } from '../../lib/business'

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>
        This policy explains how membership fees, cancellations, and refunds work at{' '}
        <strong>{BUSINESS.name}</strong>.
      </p>

      <h2>Membership fees</h2>
      <p>
        Membership fees are billed monthly and are payable in advance for the upcoming month.
        Fees are quoted and charged in Indian Rupees (INR) and are processed securely through
        our payment partner, Razorpay.
      </p>

      <h2>Refunds</h2>
      <p>
        Membership fees, once paid, are <strong>non-refundable</strong> — including for classes
        you are unable to attend during the paid month. We do not offer pro-rated refunds for
        partially used months.
      </p>

      <h2>Cancellation</h2>
      <p>
        You may cancel your membership at any time by contacting us. Cancellation stops any
        future billing from the next billing cycle onward. It does not refund the fee already
        paid for the current month; you remain welcome to attend classes for the rest of that
        paid month.
      </p>

      <h2>Duplicate or incorrect charges</h2>
      <p>
        If you are charged more than once for the same month, or believe a payment was made in
        error, please contact us within <strong>7 days</strong> of the transaction. Once we
        verify it, we will refund the extra amount to your original payment method within{' '}
        <strong>5–7 business days</strong>.
      </p>

      <h2>How to reach us</h2>
      <p>
        For any cancellation or refund request, email{' '}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or call{' '}
        <a href={`tel:+91${BUSINESS.phones[0]}`}>+91 {BUSINESS.phones[0]}</a>. Please include the
        name and phone number on your membership so we can locate your payment quickly.
      </p>
    </LegalPage>
  )
}
