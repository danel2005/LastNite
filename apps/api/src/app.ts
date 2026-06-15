import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { env } from './lib/env.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { meRoutes } from './routes/me.js'
import { eventRoutes, inviteRoutes } from './routes/events.js'
import { missionRoutes } from './routes/missions.js'
import { liveEventRoutes } from './routes/live.js'
import { submissionRoutes } from './routes/submissions.js'
import { feedRoutes } from './routes/feed.js'
import { revealRoutes } from './routes/reveal.js'
import { recapRoutes } from './routes/recap.js'
import { exportRoutes, exportJobRoutes } from './routes/export.js'
import { adminRoutes } from './routes/admin.js'
import { startEventScheduler } from './lib/event-scheduler.js'
import { startMissionWorker, stopMissionWorker } from './jobs/mission-worker.js'
import { startRevealWorker, stopRevealWorker } from './jobs/reveal-worker.js'
import { startRecapWorker, stopRecapWorker } from './jobs/recap-worker.js'
import { startExportWorker, stopExportWorker } from './jobs/export-worker.js'
import { startNotificationWorker, stopNotificationWorker } from './jobs/notification-worker.js'

interface BuildAppOptions {
  startBackgroundServices?: boolean
}

export async function buildApp(options: BuildAppOptions = {}) {
  const startBackgroundServices = options.startBackgroundServices ?? env.RUN_BACKGROUND_JOBS

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
  await app.register(eventRoutes, { prefix: '/events' })
  await app.register(inviteRoutes, { prefix: '/invites' })
  await app.register(missionRoutes, { prefix: '/events' })
  await app.register(liveEventRoutes, { prefix: '/events' })
  await app.register(submissionRoutes, { prefix: '/events' })
  await app.register(feedRoutes, { prefix: '/' })
  await app.register(revealRoutes, { prefix: '/events' })
  await app.register(recapRoutes, { prefix: '/events' })
  await app.register(exportRoutes, { prefix: '/' })
  await app.register(exportJobRoutes, { prefix: '/export-jobs' })
  await app.register(adminRoutes, { prefix: '/admin' })

  if (startBackgroundServices) {
    // Local/dev convenience. Production should run `npm run start:worker`
    // as a separate process and set RUN_BACKGROUND_JOBS=false for the API.
    const schedulerTimer = startEventScheduler(app.log)
    startMissionWorker(app.log)
    startRevealWorker(app.log)
    startRecapWorker(app.log)
    startExportWorker(app.log)
    startNotificationWorker(app.log)
    app.addHook('onClose', async () => {
      clearInterval(schedulerTimer)
      await stopMissionWorker()
      await stopRevealWorker()
      await stopRecapWorker()
      await stopExportWorker()
      await stopNotificationWorker()
    })
  }

  return app
}
