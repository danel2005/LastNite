import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import type { EventState } from '@prisma/client'

const TICK_MS = 60_000 // run every 60 seconds

/**
 * Auto-transition events based on their startsAt / endsAt datetimes.
 *
 * Transitions handled:
 *   scheduled → live       when now >= startsAt
 *   live      → ending     when now >= (endsAt - 5min)
 *   ending    → processing when now >= endsAt
 *
 * processing → completed is triggered by the reveal computation job (step 09).
 */
async function tick(log: FastifyBaseLogger) {
  const now = new Date()
  const fiveMinFromNow = new Date(now.getTime() + 5 * 60_000)

  try {
    // scheduled → live
    const toGo = await prisma.event.updateMany({
      where: {
        state: 'scheduled' as EventState,
        startsAt: { lte: now },
        deletedAt: null,
      },
      data: { state: 'live' },
    })
    if (toGo.count > 0) log.info({ count: toGo.count }, 'event-scheduler: scheduled → live')

    // live → ending  (5 min before end)
    const toEnding = await prisma.event.updateMany({
      where: {
        state: 'live' as EventState,
        endsAt: { lte: fiveMinFromNow },
        deletedAt: null,
      },
      data: { state: 'ending' },
    })
    if (toEnding.count > 0) log.info({ count: toEnding.count }, 'event-scheduler: live → ending')

    // ending → processing
    const toProcessing = await prisma.event.updateMany({
      where: {
        state: 'ending' as EventState,
        endsAt: { lte: now },
        deletedAt: null,
      },
      data: { state: 'processing' },
    })
    if (toProcessing.count > 0) log.info({ count: toProcessing.count }, 'event-scheduler: ending → processing')
  } catch (err) {
    log.error({ err }, 'event-scheduler: tick failed')
  }
}

export function startEventScheduler(log: FastifyBaseLogger): NodeJS.Timeout {
  log.info('event-scheduler: started (60s tick)')
  // Run once immediately on boot, then every TICK_MS
  tick(log)
  return setInterval(() => tick(log), TICK_MS)
}
