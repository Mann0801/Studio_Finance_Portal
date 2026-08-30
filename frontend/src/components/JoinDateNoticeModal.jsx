import { InfoIcon } from './Icons'
import { FIRST_OF_THIS_MONTH_LABEL } from '../lib/joinDate'

/* Blocking gate shown the first time a student focuses the join-date field —
   must be acknowledged before the date picker opens. The inline notice-card
   near the field stays up afterward as a lasting reference. */
export default function JoinDateNoticeModal({ open, onOk }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop">
      <div className="sheet join-date-sheet">
        <div className="notice-icon-badge">
          <InfoIcon width={22} height={22} />
        </div>
        <div className="confirm-title">Already a member of the studio?</div>
        <p>
          As your payments and records move onto the app, please set your join date to{' '}
          <strong>{FIRST_OF_THIS_MONTH_LABEL}</strong> so this month is billed in full rather
          than as a partial amount.
        </p>
        <p>
          <strong>New to the studio?</strong> Please choose the date you actually started
          attending classes, not the date you're signing up for this app.
        </p>
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onOk}>
          Okay, got it
        </button>
      </div>
    </div>
  )
}
