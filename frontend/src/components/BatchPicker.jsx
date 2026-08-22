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
 *
 * Pass `multiple` for a checkbox-style picker that lets more than one class be
 * selected at once (student signup, admin walk-in registration): `selected` is
 * `[{batch, batch_slot}]`, `onToggle(classId)` adds/removes a class, and
 * `onSlotSelect(classId, slotKey)` sets its timing.
 */
export default function BatchPicker({
  classes,
  batch,
  slot,
  onSelect,
  error,
  multiple,
  selected,
  onToggle,
  onSlotSelect,
}) {
  const list = classes || []

  if (multiple) {
    const sel = selected || []
    const isChosen = (id) => sel.some((c) => c.batch === id)
    const slotFor = (id) => sel.find((c) => c.batch === id)?.batch_slot || null

    return (
      <div>
        <div className="legend" style={{ marginBottom: 10 }}>Choose your classes</div>
        {!list.length ? (
          <div className="card empty">No classes available yet.</div>
        ) : (
          <div className="batch-list">
            {list.map((c) => {
              const chosen = isChosen(c.id)
              const showSlots = hasSlots(c) && chosen
              const sched = scheduleLabel(c)
              const chosenSlot = slotByKey(c, slotFor(c.id))
              return (
                <div className="batch-item" key={c.id}>
                  <button
                    type="button"
                    className={`batch-opt ${chosen ? 'selected' : ''}`}
                    onClick={() => onToggle(c.id)}
                    aria-expanded={hasSlots(c) ? chosen : undefined}
                  >
                    <span className="check">{chosen ? <CheckIcon width={13} height={13} /> : ''}</span>
                    <span className="b-main">
                      <span className="b-name">{c.name}</span>
                      {sched && <span className="b-sub">{sched}</span>}
                      {chosen && hasSlots(c) && chosenSlot && (
                        <span className="b-slot">{chosenSlot.name} · {slotTime(chosenSlot)}</span>
                      )}
                      {chosen && hasSlots(c) && !chosenSlot && (
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
                          className={`slot-opt ${slotFor(c.id) === s.key ? 'selected' : ''}`}
                          onClick={() => onSlotSelect(c.id, s.key)}
                        >
                          <span className="slot-name">{s.name}</span>
                          <span className="slot-time">{slotTime(s)}</span>
                          {slotFor(c.id) === s.key && (
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
