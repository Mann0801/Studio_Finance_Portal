import { BATCHES, TRADITIONAL_SLOTS, slotById } from '../lib/batches'
import { CheckIcon } from './Icons'

/**
 * Batch selector used on signup + profile setup. Selecting Traditional Yoga
 * (which has timing slots) expands an inline dropdown *directly below its card*
 * to pick a slot — no bottom sheet, so it can never hide behind the keyboard.
 * The batch is selected the moment the card is tapped; a slot must still be
 * chosen before the form will submit (enforced by the caller's validation).
 * `onSelect(batchId, slotId|null)`.
 */
export default function BatchPicker({ batch, slot, onSelect, error }) {
  const chosenSlot = slotById(slot)

  const choose = (b) => {
    // Selecting Traditional Yoga highlights it and reveals the timing dropdown,
    // preserving any slot already picked; other batches clear the slot.
    onSelect(b.id, b.hasSlots ? slot || null : null)
  }

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>Choose your batch</div>
      <div className="batch-list">
        {BATCHES.map((b) => {
          const selected = batch === b.id
          const showSlots = b.hasSlots && selected
          return (
            <div className="batch-item" key={b.id}>
              <button
                type="button"
                className={`batch-opt ${selected ? 'selected' : ''}`}
                onClick={() => choose(b)}
                aria-expanded={b.hasSlots ? selected : undefined}
              >
                <span className="check">{selected ? <CheckIcon width={13} height={13} /> : ''}</span>
                <span className="b-main">
                  <span className="b-name">{b.label}</span>
                  {b.schedule && <span className="b-sub">{b.schedule}</span>}
                  {selected && b.hasSlots && chosenSlot && (
                    <span className="b-slot">{chosenSlot.label} · {chosenSlot.time}</span>
                  )}
                  {selected && b.hasSlots && !chosenSlot && (
                    <span className="b-slot muted-warn">Choose a timing below</span>
                  )}
                </span>
                <span className="b-price">{b.price}</span>
              </button>

              {/* Inline timing dropdown — expands under Traditional Yoga only. */}
              {showSlots && (
                <div className="slot-inline">
                  <div className="slot-inline-head">Pick your timing</div>
                  {TRADITIONAL_SLOTS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`slot-opt ${slot === s.id ? 'selected' : ''}`}
                      onClick={() => onSelect('traditional_yoga', s.id)}
                    >
                      <span className="slot-name">{s.label}</span>
                      <span className="slot-time">{s.time}</span>
                      {slot === s.id && (
                        <span className="slot-check"><CheckIcon width={13} height={13} /></span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
