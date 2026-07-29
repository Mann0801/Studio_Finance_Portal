import {
  hasSlots,
  priceLabel,
  scheduleLabel,
  slotByKey,
  slotsOf,
  slotTime,
} from '../lib/classes'
import { CheckIcon } from './Icons'

/**
 * Class selector used on signup + profile setup + admin add/edit. Fed the live
 * class list (`classes` prop). Selecting a class that has timing slots expands an
 * inline dropdown directly below its card to pick one — no bottom sheet, so it
 * never hides behind the keyboard. `onSelect(classId, slotKey|null)`.
 */
export default function BatchPicker({ classes, batch, slot, onSelect, error }) {
  const list = classes || []
  const chosen = list.find((c) => c.id === batch)
  const chosenSlot = slotByKey(chosen, slot)

  const choose = (c) => onSelect(c.id, hasSlots(c) ? slot || null : null)

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>Choose your class</div>
      {!list.length ? (
        <div className="card empty">No classes available yet.</div>
      ) : (
        <div className="batch-list">
          {list.map((c) => {
            const selected = batch === c.id
            const showSlots = hasSlots(c) && selected
            const sched = scheduleLabel(c)
            return (
              <div className="batch-item" key={c.id}>
                <button
                  type="button"
                  className={`batch-opt ${selected ? 'selected' : ''}`}
                  onClick={() => choose(c)}
                  aria-expanded={hasSlots(c) ? selected : undefined}
                >
                  <span className="check">{selected ? <CheckIcon width={13} height={13} /> : ''}</span>
                  <span className="b-main">
                    <span className="b-name">{c.name}</span>
                    {sched && <span className="b-sub">{sched}</span>}
                    {selected && hasSlots(c) && chosenSlot && (
                      <span className="b-slot">{chosenSlot.name} · {slotTime(chosenSlot)}</span>
                    )}
                    {selected && hasSlots(c) && !chosenSlot && (
                      <span className="b-slot muted-warn">Choose a timing below</span>
                    )}
                  </span>
                  <span className="b-price">{priceLabel(c)}</span>
                </button>

                {showSlots && (
                  <div className="slot-inline">
                    <div className="slot-inline-head">Pick your timing</div>
                    {slotsOf(c).map((s) => (
                      <button
                        type="button"
                        key={s.key}
                        className={`slot-opt ${slot === s.key ? 'selected' : ''}`}
                        onClick={() => onSelect(c.id, s.key)}
                      >
                        <span className="slot-name">{s.name}</span>
                        <span className="slot-time">{slotTime(s)}</span>
                        {slot === s.key && (
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
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
