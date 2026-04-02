import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { healthRoutes } from './routes/health.js'

export async function buildApp() {
  const app = Fastify({
    logger:
      process.env['NODE_ENV'] === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : true,
  })

  // ─── Plugins ───────────────────────────────────────────────────────────────
  await app.register(helmet)
  await app.register(cors, {
    origin: process.env['NODE_ENV'] === 'development' ? true : false,
    credentials: true,
  })

  // ─── Routes ────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' })

  // Future route registrations go here (added in subsequent steps):
  // await app.register(authRoutes, { prefix: '/auth' })
  // await app.register(meRoutes, { prefix: '/me' })
  // await app.register(eventRoutes, { prefix: '/events' })
  // await app.register(inviteRoutes, { prefix: '/invites' })
  // await app.register(submissionRoutes, { prefix: '/submissions' })
  // await app.register(exportRoutes, { prefix: '/export-jobs' })

  return app
}
