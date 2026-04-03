import { Queue, Worker, type Job } from 'bullmq'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRedis } from '../lib/redis.js'
import { supabaseAdmin } from '../lib/supabase.js'
import { env } from '../lib/env.js'

export const REVEAL_QUEUE = 'reveal-computation'

export interface RevealJobData {
  eventId: string
}

// ─── Award computation ───────────────────────────────────────────────────────

interface AwardInput {
  userId: string
  displayName: string
  submissionCount: number
  completedMissions: number
  firstSubmissionAt: Date | null
  chaosScore: number   // sum of intensities of completed chaos missions
  totalIntensity: number
}

function computeAwards(participants: AwardInput[]): Array<{ title: string; emoji: string; userId: string; displayName: string }> {
  const awards: Array<{ title: string; emoji: string; userId: string; displayName: string }> = []
  if (participants.length === 0) return awards

  const sorted = (key: keyof AwardInput, asc = false) =>
    [...participants].sort((a, b) => {
      const av = a[key] as number
      const bv = b[key] as number
      return asc ? av - bv : bv - av
    })

  const mostActive = sorted('submissionCount')[0]
  if (mostActive && mostActive.submissionCount > 0) {
    awards.push({ title: 'Most Active', emoji: '📸', userId: mostActive.userId, displayName: mostActive.displayName })
  }

  const missionMachine = sorted('completedMissions')[0]
  if (missionMachine && missionMachine.completedMissions > 0) {
    awards.push({ title: 'Mission Machine', emoji: '🎯', userId: missionMachine.userId, displayName: missionMachine.displayName })
  }

  const withFirst = participants.filter((p) => p.firstSubmissionAt)
  if (withFirst.length > 0) {
    const firstBlood = withFirst.sort(
      (a, b) => a.firstSubmissionAt!.getTime() - b.firstSubmissionAt!.getTime(),
    )[0]!
    awards.push({ title: 'First Blood', emoji: '⚡', userId: firstBlood.userId, displayName: firstBlood.displayName })
  }

  const bestChaos = sorted('chaosScore')[0]
  if (bestChaos && bestChaos.chaosScore > 0) {
    awards.push({ title: 'Best Chaos', emoji: '💥', userId: bestChaos.userId, displayName: bestChaos.displayName })
  }

  const mostCreative = sorted('totalIntensity')[0]
  if (mostCreative && mostCreative.totalIntensity > 0 && mostCreative.userId !== missionMachine?.userId) {
    awards.push({ title: 'Most Daring', emoji: '🔥', userId: mostCreative.userId, displayName: mostCreative.displayName })
  }

  return awards
}

// ─── Reveal computation ──────────────────────────────────────────────────────

async function computeReveal(eventId: string, log: FastifyBaseLogger): Promise<void> {
  log.info({ eventId }, 'reveal-worker: starting computation')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event) {
    log.warn({ eventId }, 'reveal-worker: event not found')
    return
  }

  // Fetch all mission instances with their assignments + submissions
  const instances = await prisma.missionInstance.findMany({
    where: { eventId },
    include: {
      definition: true,
      assignments: {
        include: {
          user: { include: { profile: true } },
          submission: {
            include: {
              assets: {
                where: { status: 'uploaded' },
                select: { id: true, storageKey: true, assetType: true, widthPx: true, heightPx: true, durationMs: true },
              },
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  })

  // Fetch all participants
  const participants = await prisma.participant.findMany({
    where: { eventId, removedAt: null },
    include: { user: { include: { profile: true } } },
  })

  // Compute per-participant stats for awards
  const participantStats = new Map<
    string,
    AwardInput
  >()
  for (const p of participants) {
    participantStats.set(p.userId, {
      userId: p.userId,
      displayName: p.user.profile?.displayName ?? p.userId,
      submissionCount: 0,
      completedMissions: 0,
      firstSubmissionAt: null,
      chaosScore: 0,
      totalIntensity: 0,
    })
  }

  // Build reveal missions array
  const revealMissions = instances
    .filter((inst) => inst.assignments.length > 0)
    .map((inst) => {
      const timeline = inst.assignments.map((a) => {
        const stats = participantStats.get(a.userId)
        if (stats) {
          if (a.status === 'completed') {
            stats.completedMissions++
            stats.totalIntensity += inst.definition.intensity
            if (inst.definition.category === 'chaos') {
              stats.chaosScore += inst.definition.intensity
            }
          }
          if (a.submission) {
            stats.submissionCount++
            const sub = a.submission
            const subAt = sub.createdAt
            if (!stats.firstSubmissionAt || subAt < stats.firstSubmissionAt) {
              stats.firstSubmissionAt = subAt
            }
          }
        }

        return {
          assignmentId: a.id,
          userId: a.userId,
          displayName: a.user.profile?.displayName ?? a.userId,
          assignedAt: a.assignedAt,
          completedAt: a.completedAt,
          status: a.status,
          isSecret: a.isSecret,
          submission: a.submission
            ? {
                id: a.submission.id,
                createdAt: a.submission.createdAt,
                assets: a.submission.assets,
              }
            : null,
        }
      })

      return {
        missionInstanceId: inst.id,
        definitionId: inst.definition.id,
        title: inst.definition.title,
        description: inst.definition.description,
        category: inst.definition.category,
        mediaType: inst.definition.mediaType,
        intensity: inst.definition.intensity,
        isFinale: inst.isFinale,
        isCustom: !inst.definition.isSystem,
        createdByUserId: inst.definition.createdByUserId,
        targetUserId: inst.definition.targetUserId,
        assignmentTimeline: timeline,
      }
    })

  // Compute stats
  const allSubmissions = instances.flatMap((i) =>
    i.assignments.flatMap((a) => (a.submission ? [a.submission] : [])),
  )
  const allAssignments = instances.flatMap((i) => i.assignments)
  const completedCount = allAssignments.filter((a) => a.status === 'completed').length

  const stats = {
    totalParticipants: participants.length,
    totalMissionsAssigned: allAssignments.length,
    totalMissionsCompleted: completedCount,
    totalSubmissions: allSubmissions.length,
    participationRate:
      allAssignments.length > 0 ? Math.round((completedCount / allAssignments.length) * 100) : 0,
  }

  // Generate signed read URLs for submission assets
  // (We store storageKeys; the reveal payload embeds signed URLs)
  const revealWithUrls = await Promise.all(
    revealMissions.map(async (m) => ({
      ...m,
      assignmentTimeline: await Promise.all(
        m.assignmentTimeline.map(async (t) => ({
          ...t,
          submission: t.submission
            ? {
                ...t.submission,
                assets: await Promise.all(
                  t.submission.assets.map(async (a) => ({
                    ...a,
                    url: await signedReadUrl(a.storageKey),
                  })),
                ),
              }
            : null,
        })),
      ),
    })),
  )

  // Compute awards
  const awardsInput = Array.from(participantStats.values())
  const awards = computeAwards(awardsInput)

  // Upsert RecapArtifact — single payload JSON with sub-keys
  await prisma.recapArtifact.upsert({
    where: { eventId },
    create: {
      eventId,
      generatedAt: new Date(),
      payload: {
        reveal: { missions: revealWithUrls, awards, stats },
        // recap fields populated in step 10
        timeline: null,
        byMission: null,
        byParticipant: null,
        collage: null,
        highlight: null,
      },
    },
    update: {
      generatedAt: new Date(),
      payload: {
        reveal: { missions: revealWithUrls, awards, stats },
        timeline: null,
        byMission: null,
        byParticipant: null,
        collage: null,
        highlight: null,
      },
    },
  })

  // Transition to completed
  await prisma.event.update({
    where: { id: eventId },
    data: { state: 'completed' },
  })

  log.info({ eventId, missions: revealWithUrls.length, awards: awards.length }, 'reveal-worker: computation complete')
}

async function signedReadUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(env.STORAGE_BUCKET_MEDIA)
    .createSignedUrl(storageKey, 7 * 24 * 3600) // 7 days for the reveal
  if (error || !data) return null
  return data.signedUrl
}

// ─── Queue + Worker bootstrap ────────────────────────────────────────────────

let _queue: Queue | null = null

export function getRevealQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(REVEAL_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
    })
  }
  return _queue
}

let _worker: Worker | null = null

export function startRevealWorker(log: FastifyBaseLogger): Worker {
  _worker = new Worker(
    REVEAL_QUEUE,
    async (job: Job) => {
      const data = job.data as RevealJobData
      await computeReveal(data.eventId, log)
    },
    { connection: getRedis(), concurrency: 2 },
  )

  _worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'reveal-worker: job failed')
  })

  log.info('reveal-worker: started')
  return _worker
}

export async function stopRevealWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
}
