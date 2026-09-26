import {
  hasAnyPlan,
  hasSlots,
  planOptions,
  priceLabel,
  scheduleLabel,
  slotByKey,
  slotsOf,
  slotTime,
} from '../lib/classes'
import { CheckIcon } from './Icons'

/** The "choose your plan" sub-step for a class that offers more than just its
 * default billing — shown once a timing slot is picked (or immediately for a
 * class with no slots). Reuses the timing picker's visual style. */
function PlanPicker({ cls, plan, onPick }) {
  const current = plan || 'monthly'
  return (
    <div className="slot-inline">
      <div className="slot-inline-head">Choose your plan</div>
      {planOptions(cls).map((o) => (
        <button
          type="button"
          key={o.id}
          className={`slot-opt ${current === o.id ? 'selected' : ''}`}
          onClick={() => onPick(o.id)}
        >
          <span className="slot-name">{o.label}</span>
          <span className="slot-time">{o.price}</span>
          {current === o.id && <span className="slot-check"><CheckIcon width={13} height={13} /></span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Class selector used on signup + profile setup + admin add/edit. Fed the live
 * class list (`classes` prop). Selecting a class that has timing slots expands an
 * inline dropdown directly below its card to pick one — no bottom sheet, so it
 * never hides behind the keyboard. `onSelect(classId, slotKey|null)`. A class
 * with a package and/or alternate session tier configured also gets a
 * "choose your plan" sub-step, shown once its timing (if any) is picked.
 *
 * Pass `multiple` for a checkbox-style picker that lets more than one class be
 * selected at once (student signup, admin walk-in registration): `selected` is
 * `[{batch, batch_slot, plan}]`, `onToggle(classId)` adds/removes a class,
 * `onSlotSelect(classId, slotKey)` sets its timing, and `onPlanSelect(classId,
 * plan)` sets its plan.
 */
export default function BatchPicker({
  classes,
  batch,
  slot,
  plan,
  onSelect,
  onPlanSelect,
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
    const planFor = (id) => sel.find((c) => c.batch === id)?.plan || 'monthly'

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
              const chosenSlot = slotByKey(c, slotFor(c.id))
              const showPlan = chosen && hasAnyPlan(c) && (!hasSlots(c) || chosenSlot)
              const sched = scheduleLabel(c)
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

                  {showPlan && (
                    <PlanPicker cls={c} plan={planFor(c.id)} onPick={(p) => onPlanSelect(c.id, p)} />
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
  const showPlan = Boolean(chosen) && hasAnyPlan(chosen) && (!hasSlots(chosen) || chosenSlot)

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

                {selected && showPlan && (
                  <PlanPicker cls={c} plan={plan} onPick={(p) => onPlanSelect(p)} />
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
