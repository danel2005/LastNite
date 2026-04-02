import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { env } from '../lib/env.js'

async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    // Relax in dev
    ...(env.isDev && { max: 1000 }),
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit' })
