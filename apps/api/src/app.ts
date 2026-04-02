import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './lib/env.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { meRoutes } from './routes/me.js'

export async function buildApp() {
  const app = Fastify({
    logger: env.isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
  })

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(helmet)
  await app.register(cors, {
    origin: env.isDev ? true : false,
    credentials: true,
  })
  await app.register(rateLimitPlugin)
  await app.register(authPlugin)

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(meRoutes, { prefix: '/me' })

  // Future routes (added in subsequent steps):
  // await app.register(eventRoutes, { prefix: '/events' })
  // await app.register(inviteRoutes, { prefix: '/invites' })
  // await app.register(submissionRoutes, { prefix: '/submissions' })
  // await app.register(exportRoutes, { prefix: '/export-jobs' })

  return app
}
