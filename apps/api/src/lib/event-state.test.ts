import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from './event-state.js'

describe('event state transitions', () => {
  it('allows the happy-path event lifecycle', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true)
    expect(canTransition('scheduled', 'live')).toBe(true)
    expect(canTransition('live', 'ending')).toBe(true)
    expect(canTransition('ending', 'processing')).toBe(true)
    expect(canTransition('processing', 'completed')).toBe(true)
    expect(canTransition('completed', 'archived')).toBe(true)
  })

  it('rejects reveal/completion before processing', () => {
    expect(canTransition('scheduled', 'completed')).toBe(false)
    expect(() => assertTransition('scheduled', 'completed')).toThrow(
      'Invalid event state transition',
    )
  })

  it('allows cancellation before processing', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true)
    expect(canTransition('scheduled', 'cancelled')).toBe(true)
    expect(canTransition('live', 'cancelled')).toBe(true)
    expect(canTransition('ending', 'cancelled')).toBe(true)
    expect(canTransition('processing', 'cancelled')).toBe(false)
  })
})
