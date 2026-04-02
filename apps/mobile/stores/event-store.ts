import { create } from 'zustand'
import type { Event, LiveEventState } from '@lastnite/shared'

interface EventStoreState {
  events: Event[]
  activeEventId: string | null
  liveState: LiveEventState | null

  setEvents: (events: Event[]) => void
  setActiveEvent: (id: string | null) => void
  setLiveState: (state: LiveEventState | null) => void
}

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  activeEventId: null,
  liveState: null,

  setEvents: (events) => set({ events }),
  setActiveEvent: (id) => set({ activeEventId: id }),
  setLiveState: (state) => set({ liveState: state }),
}))
