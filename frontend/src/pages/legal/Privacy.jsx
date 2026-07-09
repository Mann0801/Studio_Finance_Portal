import { Link } from 'react-router-dom'
import LegalPage from './LegalPage'
import { BUSINESS } from '../../lib/business'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains how <strong>{BUSINESS.name}</strong> collects, uses, and
        protects your personal information when you use our membership app.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Your name, email address, and phone number.</li>
        <li>Your chosen batch and membership join date.</li>
        <li>Your payment history (amounts, dates, and status) for the membership.</li>
      </ul>
      <p>
        We do <strong>not</strong> collect or store your card, UPI, or bank details. All payment
        information is handled directly by our payment partner, Razorpay.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To create and manage your membership account.</li>
        <li>To process your monthly membership payments.</li>
        <li>To send you payment reminders and account-related messages via WhatsApp or email.</li>
        <li>To run and improve our classes and studio operations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share information only with the service providers that make the app work:
      </p>
      <ul>
        <li><strong>Razorpay</strong> — to process payments securely.</li>
        <li><strong>Supabase</strong> — our secure database and authentication provider.</li>
      </ul>
      <p>We do not sell your personal information to anyone.</p>

      <h2>Data security</h2>
      <p>
        Your data is stored securely and access is restricted to authorised studio staff. We take
        reasonable measures to protect your information, though no method of transmission over the
        internet is completely secure.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request access to, correction of, or deletion of your personal information at any
        time by contacting us. You can also update your name, phone, and batch from within the app.
      </p>

      <h2>Contact</h2>
      <p>
        For any privacy questions or requests, see our <Link to="/contact">Contact page</Link> or
        email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </LegalPage>
  )
}
