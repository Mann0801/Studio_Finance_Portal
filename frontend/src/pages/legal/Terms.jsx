import { Link } from 'react-router-dom'
import LegalPage from './LegalPage'
import { BUSINESS } from '../../lib/business'

export default function Terms() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These Terms &amp; Conditions govern your use of the <strong>{BUSINESS.name}</strong>{' '}
        membership app and services, operated by {BUSINESS.owner}. By creating an account or
        making a payment, you agree to these terms.
      </p>

      <h2>Our services</h2>
      <p>
        {BUSINESS.name} provides fitness and yoga classes on a monthly membership basis. This
        app lets members sign up, view their batch and fees, make membership payments, and track
        their payment history.
      </p>

      <h2>Membership &amp; payments</h2>
      <ul>
        <li>Membership fees are charged monthly, in advance, in Indian Rupees (INR).</li>
        <li>
          Payments are processed securely by our payment partner, Razorpay. We do not store your
          card, UPI, or bank details on our servers.
        </li>
        <li>
          Cancellations and refunds are handled per our{' '}
          <Link to="/refund">Refund &amp; Cancellation Policy</Link>.
        </li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate account information (name, email, phone, batch) and keep it current.</li>
        <li>Keep your login credentials secure; you are responsible for activity on your account.</li>
        <li>Follow the studio's class schedule, safety guidance, and code of conduct.</li>
      </ul>

      <h2>Health &amp; safety</h2>
      <p>
        You should consult a physician before beginning any exercise programme. You participate in
        all classes and activities at your own risk. {BUSINESS.name} is not liable for any injury
        or health condition arising from your participation, to the extent permitted by law.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Continued use of the app after changes take
        effect means you accept the updated terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and any disputes are subject to the
        jurisdiction of the courts of {BUSINESS.city}, Karnataka.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? See our <Link to="/contact">Contact page</Link> or email{' '}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
      </p>
    </LegalPage>
  )
}
