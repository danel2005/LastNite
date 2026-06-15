import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import type { EventState } from '@prisma/client'
import { scheduleEventMissions } from '../jobs/mission-worker.js'
import { getRevealQueue } from '../jobs/reveal-worker.js'

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
    const nowLiveEvents = await prisma.event.findMany({
      where: { state: 'scheduled' as EventState, startsAt: { lte: now }, deletedAt: null },
      select: { id: true, endsAt: true },
    })
    if (nowLiveEvents.length > 0) {
      await prisma.event.updateMany({
        where: { id: { in: nowLiveEvents.map((e) => e.id) } },
        data: { state: 'live' },
      })
      log.info({ count: nowLiveEvents.length }, 'event-scheduler: scheduled → live')
      // Kick off mission dispatch for each newly-live event
      for (const e of nowLiveEvents) {
        await scheduleEventMissions(e.id, e.endsAt, log)
      }
    }
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
    const processingEvents = await prisma.event.findMany({
      where: {
        state: 'ending' as EventState,
        endsAt: { lte: now },
        deletedAt: null,
      },
      select: { id: true },
    })
    if (processingEvents.length > 0) {
      await prisma.event.updateMany({
        where: { id: { in: processingEvents.map((event) => event.id) } },
        data: { state: 'processing' },
      })

      const revealQueue = getRevealQueue()
      for (const event of processingEvents) {
        await revealQueue.add(
          'compute-reveal',
          { eventId: event.id },
          { jobId: `reveal-${event.id}` },
        )
      }

      log.info(
        { count: processingEvents.length },
        'event-scheduler: ending → processing; reveal jobs enqueued',
      )
    }
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
