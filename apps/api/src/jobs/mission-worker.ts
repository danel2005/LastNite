import { Worker, type Job } from 'bullmq'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRedis } from '../lib/redis.js'
import { getMissionQueue, MISSION_QUEUE } from './mission-queue.js'
import type { DispatchJobData, ExpireJobData, FinaleJobData, MissionJobName } from './mission-queue.js'

// ─── Assignment algorithm ────────────────────────────────────────────────────

/**
 * Assign one mission to each active participant who doesn't already have an
 * active/pending assignment in this event tick.
 *
 * Algorithm:
 * 1. Fetch all active participants for the event
 * 2. For each participant:
 *    a. Skip if they already have an active (non-expired, non-completed) assignment
 *    b. Build a pool of eligible MissionInstances:
 *       - Created for this event (via EventMissionPack)
 *       - Not already assigned to this user (anti-repeat via @@unique constraint)
 *       - Respects UserMissionPreference (intensity, isSocial)
 *       - Respects event.safeMode and event.allowPublicSocialMissions
 *    c. Pick a random eligible instance
 *    d. Create MissionAssignment row
 */
async function dispatchMissions(eventId: string, log: FastifyBaseLogger): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      activePacks: { include: { pack: { include: { definitions: { include: { definition: true } } } } } },
      participants: {
        where: { removedAt: null },
        include: {
          user: { include: { missionPreference: true } },
        },
      },
      missionInstances: {
        include: { assignments: { select: { userId: true, status: true } } },
      },
    },
  })

  if (!event) {
    log.warn({ eventId }, 'mission-worker: event not found')
    return
  }
  if (event.state !== 'live') {
    log.info({ eventId, state: event.state }, 'mission-worker: event not live, skipping dispatch')
    return
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + event.missionIntervalMinutes * 60_000)

  // Build the global pool of all definitions available for this event
  const definitionPool = new Map<
    string,
    { id: string; intensity: number; isSocial: boolean; defaultIsSecret: boolean }
  >()
  for (const ep of event.activePacks) {
    for (const pd of ep.pack.definitions) {
      const d = pd.definition
      // Respect safeMode: skip intensity >= 4
      if (event.safeMode && d.intensity >= 4) continue
      // Respect allowPublicSocialMissions: skip isSocial missions if disabled
      if (!event.allowPublicSocialMissions && d.isSocial) continue
      // Skip intensity > missionIntensity setting
      if (d.intensity > event.missionIntensity) continue
      definitionPool.set(d.id, {
        id: d.id,
        intensity: d.intensity,
        isSocial: d.isSocial,
        defaultIsSecret: d.defaultIsSecret,
      })
    }
  }

  if (definitionPool.size === 0) {
    log.warn({ eventId }, 'mission-worker: no eligible definitions in pool')
    return
  }

  // Build a lookup: which definitionIds have instances for this event
  const instanceByDefinitionId = new Map(
    event.missionInstances.map((mi) => [mi.definitionId, mi]),
  )

  // Track assignments made in this tick (to avoid duplicate work)
  let assigned = 0

  for (const participant of event.participants) {
    const userId = participant.userId
    const pref = participant.user.missionPreference

    // Skip if participant already has an active assignment
    const hasActive = event.missionInstances.some((mi) =>
      mi.assignments.some(
        (a) => a.userId === userId && (a.status === 'active' || a.status === 'pending'),
      ),
    )
    if (hasActive) continue

    // Build per-user eligible pool (apply user preferences + anti-repeat)
    const assignedInstanceIds = new Set(
      event.missionInstances
        .filter((mi) => mi.assignments.some((a) => a.userId === userId))
        .map((mi) => mi.id),
    )

    const eligible = Array.from(definitionPool.values()).filter((def) => {
      // User preference overrides
      if (pref?.disablePublicSocial && def.isSocial) return false
      if (pref?.disableIntensityAbove != null && def.intensity > pref.disableIntensityAbove) return false

      // Anti-repeat: if there's already an instance for this definition and the user has it, skip
      const instance = instanceByDefinitionId.get(def.id)
      if (instance && assignedInstanceIds.has(instance.id)) return false

      return true
    })

    if (eligible.length === 0) {
      log.info({ eventId, userId }, 'mission-worker: no eligible missions for user (all done or filtered)')
      continue
    }

    // Pick a random mission from the eligible pool
    const chosen = eligible[Math.floor(Math.random() * eligible.length)]!

    // Get or create the MissionInstance for this event + definition
    let instance = instanceByDefinitionId.get(chosen.id)
    if (!instance) {
      instance = await prisma.missionInstance.create({
        data: { eventId, definitionId: chosen.id },
        include: { assignments: { select: { userId: true, status: true } } },
      })
      instanceByDefinitionId.set(chosen.id, instance)
      // Also push to event.missionInstances so the loop stays consistent
      event.missionInstances.push(instance)
    }

    // Create the assignment
    try {
      await prisma.missionAssignment.create({
        data: {
          missionInstanceId: instance.id,
          eventId,
          userId,
          isSecret: chosen.defaultIsSecret,
          status: 'active',
          expiresAt,
        },
      })
      assigned++
    } catch (err: unknown) {
      // Unique constraint violation = user already has this instance; skip silently
      if (isUniqueConstraintError(err)) continue
      throw err
    }
  }

  log.info({ eventId, assigned }, 'mission-worker: dispatch tick complete')

  // Schedule the next tick
  const queue = getMissionQueue()
  await queue.add(
    'dispatch',
    { eventId } satisfies DispatchJobData,
    { delay: event.missionIntervalMinutes * 60_000 },
  )
}

/**
 * Expire assignments that have passed their expiresAt without being completed.
 */
async function expireMissions(eventId: string, log: FastifyBaseLogger): Promise<void> {
  const now = new Date()
  const result = await prisma.missionAssignment.updateMany({
    where: {
      eventId,
      status: 'active',
      expiresAt: { lte: now },
    },
    data: { status: 'expired' },
  })
  if (result.count > 0) {
    log.info({ eventId, count: result.count }, 'mission-worker: expired assignments')
    // Immediately trigger a new dispatch tick for affected participants
    const queue = getMissionQueue()
    await queue.add('dispatch', { eventId } satisfies DispatchJobData, { delay: 0 })
  }
}

/**
 * Assign the finale mission to ALL participants simultaneously.
 * Triggered 30 minutes before event end.
 */
async function assignFinaleMissions(eventId: string, log: FastifyBaseLogger): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participants: { where: { removedAt: null } },
      missionInstances: {
        where: { isFinale: true },
        include: { assignments: { select: { userId: true } } },
      },
    },
  })

  if (!event || event.state !== 'live') return

  const expiresAt = event.endsAt

  // Find a finale definition — prefer category 'finale', intensity >= 3
  const finaleDef = await prisma.missionDefinition.findFirst({
    where: { isSystem: true, category: 'finale', deletedAt: null },
    orderBy: { intensity: 'desc' },
  })

  if (!finaleDef) {
    log.warn({ eventId }, 'mission-worker: no finale definition found')
    return
  }

  // Get or create the finale MissionInstance
  let finaleInstance = event.missionInstances[0]
  if (!finaleInstance) {
    finaleInstance = await prisma.missionInstance.create({
      data: { eventId, definitionId: finaleDef.id, isFinale: true },
      include: { assignments: { select: { userId: true } } },
    })
  }

  const alreadyAssigned = new Set(finaleInstance.assignments.map((a) => a.userId))
  let count = 0

  for (const participant of event.participants) {
    if (alreadyAssigned.has(participant.userId)) continue
    try {
      await prisma.missionAssignment.create({
        data: {
          missionInstanceId: finaleInstance.id,
          eventId,
          userId: participant.userId,
          isSecret: false,
          status: 'active',
          expiresAt,
        },
      })
      count++
    } catch {
      // Skip if already exists
    }
  }

  log.info({ eventId, count }, 'mission-worker: finale missions assigned')
}

// ─── Worker bootstrap ────────────────────────────────────────────────────────

let _worker: Worker | null = null

export function startMissionWorker(log: FastifyBaseLogger): Worker {
  _worker = new Worker(
    MISSION_QUEUE,
    async (job: Job) => {
      const name = job.name as MissionJobName
      const data = job.data as DispatchJobData | ExpireJobData | FinaleJobData

      if (name === 'dispatch') {
        await dispatchMissions((data as DispatchJobData).eventId, log)
      } else if (name === 'expire') {
        await expireMissions((data as ExpireJobData).eventId, log)
      } else if (name === 'finale') {
        await assignFinaleMissions((data as FinaleJobData).eventId, log)
      } else {
        log.warn({ name }, 'mission-worker: unknown job name')
      }
    },
    {
      connection: getRedis(),
      concurrency: 5,
    },
  )

  _worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'mission-worker: job failed')
  })

  log.info('mission-worker: started')
  return _worker
}

export async function stopMissionWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

/**
 * Called by the event scheduler when an event goes live.
 * Schedules the first dispatch tick (immediately) plus a finale job 30min before end.
 */
export async function scheduleEventMissions(
  eventId: string,
  endsAt: Date,
  log: FastifyBaseLogger,
): Promise<void> {
  const queue = getMissionQueue()
  const now = Date.now()
  const finaleDelay = Math.max(0, endsAt.getTime() - now - 30 * 60_000)

  await queue.add('dispatch', { eventId } satisfies DispatchJobData, { delay: 0 })
  await queue.add('finale', { eventId } satisfies FinaleJobData, { delay: finaleDelay })

  log.info({ eventId, finaleDelayMs: finaleDelay }, 'mission-worker: event missions scheduled')
}
