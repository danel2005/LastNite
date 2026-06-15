import 'dotenv/config'
import Fastify from 'fastify'
import { env } from './lib/env.js'
import { closeRedis } from './lib/redis.js'
import { startEventScheduler } from './lib/event-scheduler.js'
import { startMissionWorker, stopMissionWorker } from './jobs/mission-worker.js'
import { startRevealWorker, stopRevealWorker } from './jobs/reveal-worker.js'
import { startRecapWorker, stopRecapWorker } from './jobs/recap-worker.js'
import { startExportWorker, stopExportWorker } from './jobs/export-worker.js'
import { startNotificationWorker, stopNotificationWorker } from './jobs/notification-worker.js'

async function main() {
  const loggerHost = Fastify({
    logger: env.isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
  })
  const log = loggerHost.log
  const schedulerTimer = startEventScheduler(log)

  startMissionWorker(log)
  startRevealWorker(log)
  startRecapWorker(log)
  startExportWorker(log)
  startNotificationWorker(log)

  let shuttingDown = false
  async function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) return
    shuttingDown = true
    log.info({ signal }, 'LastNite worker shutting down')
    clearInterval(schedulerTimer)
    await stopMissionWorker()
    await stopRevealWorker()
    await stopRecapWorker()
    await stopExportWorker()
    await stopNotificationWorker()
    await closeRedis()
    await loggerHost.close()
    process.exit(0)
  }

  process.on('SIGINT', (signal) => void shutdown(signal))
  process.on('SIGTERM', (signal) => void shutdown(signal))

  log.info('LastNite worker running')
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
