import { randomBytes } from 'crypto'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generate a random 8-character alphanumeric invite code.
 */
export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CHARS[bytes[i]! % CHARS.length]
  }
  return code
}
