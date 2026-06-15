import type { FastifyRequest } from 'fastify'
import { env } from './env.js'

export function isAdminRequest(request: FastifyRequest): boolean {
  const adminIds = env.ADMIN_USER_IDS
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return adminIds.includes(request.user.sub) || (env.isDev && !!env.DEV_AUTH_OTP)
}
