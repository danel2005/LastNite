import { describe, expect, it } from 'vitest'
import { generateInviteCode } from './invite-code.js'

describe('generateInviteCode', () => {
  it('generates alphanumeric codes with the requested length', () => {
    const code = generateInviteCode(10)

    expect(code).toHaveLength(10)
    expect(code).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('defaults to eight characters', () => {
    expect(generateInviteCode()).toHaveLength(8)
  })
})
