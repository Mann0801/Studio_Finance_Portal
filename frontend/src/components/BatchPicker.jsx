import { useState } from 'react'
import { BATCHES, TRADITIONAL_SLOTS, slotById } from '../lib/batches'
import { CheckIcon, CloseIcon } from './Icons'

/**
 * Batch selector used on signup + profile setup. Tapping a batch that has timing
 * slots (Traditional Yoga) opens a bottom sheet to pick the slot; the chosen slot
 * is shown under the selected batch. `onSelect(batchId, slotId|null)`.
 */
export default function BatchPicker({ batch, slot, onSelect, error }) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const choose = (b) => {
    if (b.hasSlots) {
      setSheetOpen(true)
      return
    }
    onSelect(b.id, null)
  }

  const pickSlot = (slotId) => {
    onSelect('traditional_yoga', slotId)
    setSheetOpen(false)
  }

  const chosenSlot = slotById(slot)

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>Choose your batch</div>
      <div className="batch-list">
        {BATCHES.map((b) => {
          const selected = batch === b.id
          return (
            <button
              type="button"
              key={b.id}
              className={`batch-opt ${selected ? 'selected' : ''}`}
              onClick={() => choose(b)}
            >
              <span className="check">{selected ? <CheckIcon width={13} height={13} /> : ''}</span>
              <span className="b-main">
                <span className="b-name">{b.label}</span>
                {b.schedule && <span className="b-sub">{b.schedule}</span>}
                {selected && b.hasSlots && chosenSlot && (
                  <span className="b-slot">{chosenSlot.label} · {chosenSlot.time}</span>
                )}
                {selected && b.hasSlots && !chosenSlot && (
                  <span className="b-slot muted-warn">Tap to choose a timing</span>
                )}
              </span>
              <span className="b-price">{b.price}</span>
            </button>
          )
        })}
      </div>
      {error && <span className="field-error">{error}</span>}

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <div>
                <h2 style={{ margin: 0 }}>Pick a timing</h2>
                <p className="muted small" style={{ margin: '2px 0 0' }}>Traditional Yoga · Mon to Fri</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                aria-label="Close"
                onClick={() => setSheetOpen(false)}
              >
                <CloseIcon width={18} height={18} />
              </button>
            </div>
            <div className="slot-list">
              {TRADITIONAL_SLOTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`slot-opt ${slot === s.id ? 'selected' : ''}`}
                  onClick={() => pickSlot(s.id)}
                >
                  <span className="slot-name">{s.label}</span>
                  <span className="slot-time">{s.time}</span>
                  {slot === s.id && <span className="slot-check"><CheckIcon width={13} height={13} /></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
