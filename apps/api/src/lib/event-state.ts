import type { EventState } from '@prisma/client'

/**
 * Valid forward state transitions for an event.
 *
 * draft → scheduled  (immediately on creation)
 * scheduled → live   (at startsAt)
 * live → ending      (5 min before endsAt)
 * ending → processing (at endsAt)
 * processing → completed (after reveal computation)
 * completed → archived   (manual / housekeeping)
 * any state → cancelled  (host cancels)
 */
const TRANSITIONS: Partial<Record<EventState, EventState[]>> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live: ['ending', 'cancelled'],
  ending: ['processing', 'cancelled'],
  processing: ['completed'],
  completed: ['archived'],
}

export function canTransition(from: EventState, to: EventState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Attempt a transition, throwing if invalid.
 */
export function assertTransition(from: EventState, to: EventState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid event state transition: ${from} → ${to}`)
  }
}
