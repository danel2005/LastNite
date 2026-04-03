import { Queue, Worker, type Job } from 'bullmq'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRedis } from '../lib/redis.js'

export const RECAP_QUEUE = 'recap-generation'

export interface RecapJobData {
  eventId: string
}

// ─── Heuristics ──────────────────────────────────────────────────────────────

/**
 * Select best N assets for a photo collage.
 *
 * Rules (all server-side, no ML):
 *   1. Balance participants — cap contribution per user at ceil(n / participants)
 *   2. Balance time — prefer spread across event duration
 *   3. Prefer photo over video for collage
 *   4. If < 5 total submissions: include everything
 */
function selectCollageAssets(
  submissions: SubmissionWithMeta[],
  targetN: number,
  eventDurationMs: number,
): SelectedAsset[] {
  if (submissions.length === 0) return []

  const photos = submissions.filter((s) =>
    s.assets.some((a) => a.assetType === 'photo'),
  )
  const pool = photos.length >= 3 ? photos : submissions

  if (pool.length <= 5) {
    return pool.flatMap((s) =>
      s.assets.slice(0, 1).map((a) => ({
        assetId: a.id,
        submissionId: s.id,
        userId: s.userId,
        displayName: s.displayName,
        assetType: a.assetType,
        storageKey: a.storageKey,
        createdAt: s.createdAt,
      })),
    )
  }

  const participantIds = [...new Set(pool.map((s) => s.userId))]
  const maxPerUser = Math.ceil(targetN / participantIds.length)

  // Bucket submissions into time windows
  const buckets = 4
  const windowMs = eventDurationMs / buckets
  const bucketedPool = pool.map((s) => ({
    ...s,
    bucket: Math.min(buckets - 1, Math.floor(s.offsetMs / windowMs)),
  }))

  // Sort within each bucket and pick round-robin across participants + buckets
  const selected: SelectedAsset[] = []
  const userCounts = new Map<string, number>()

  for (let pass = 0; pass < targetN && selected.length < targetN; pass++) {
    for (const userId of participantIds) {
      if (selected.length >= targetN) break
      const count = userCounts.get(userId) ?? 0
      if (count >= maxPerUser) continue

      const candidates = bucketedPool
        .filter(
          (s) =>
            s.userId === userId &&
            !selected.some((sel) => sel.submissionId === s.id),
        )
        .sort((a, b) => a.bucket - b.bucket)

      const chosen = candidates[0]
      if (!chosen) continue

      const asset = chosen.assets.find((a) => a.assetType === 'photo') ?? chosen.assets[0]
      if (!asset) continue

      selected.push({
        assetId: asset.id,
        submissionId: chosen.id,
        userId: chosen.userId,
        displayName: chosen.displayName,
        assetType: asset.assetType,
        storageKey: asset.storageKey,
        createdAt: chosen.createdAt,
      })
      userCounts.set(userId, count + 1)
    }
  }

  return selected
}

/**
 * Select 8–12 clips for the highlight reel.
 *
 * Rules:
 *   1. Prefer video clips under 15s
 *   2. Balance participants
 *   3. Balance time (spread across event)
 *   4. Prefer group content (group_selfie, duo, everyone_now categories)
 */
function selectHighlightClips(
  submissions: SubmissionWithMeta[],
  eventDurationMs: number,
): SelectedAsset[] {
  const TARGET_MIN = 8
  const TARGET_MAX = 12
  const PREFERRED_DURATION_MS = 15_000

  // Prefer videos; fall back to all if not enough videos
  const videoSubs = submissions.filter((s) => s.assets.some((a) => a.assetType === 'video'))
  const pool = videoSubs.length >= TARGET_MIN ? videoSubs : submissions

  if (pool.length <= TARGET_MIN) {
    return pool.flatMap((s) =>
      s.assets.slice(0, 1).map((a) => ({
        assetId: a.id,
        submissionId: s.id,
        userId: s.userId,
        displayName: s.displayName,
        assetType: a.assetType,
        storageKey: a.storageKey,
        createdAt: s.createdAt,
        durationMs: a.durationMs,
      })),
    )
  }

  const targetN = Math.min(TARGET_MAX, Math.max(TARGET_MIN, Math.floor(pool.length * 0.3)))
  const participantIds = [...new Set(pool.map((s) => s.userId))]
  const maxPerUser = Math.ceil(targetN / participantIds.length)

  const buckets = 4
  const windowMs = eventDurationMs / buckets

  // Score each submission
  const scored = pool.map((s) => {
    const videoAsset = s.assets.find((a) => a.assetType === 'video')
    const asset = videoAsset ?? s.assets[0]!
    const durationScore = asset.durationMs != null && asset.durationMs <= PREFERRED_DURATION_MS ? 2 : 0
    const groupScore = ['group_selfie', 'duo', 'everyone_now', 'chaos'].includes(s.category ?? '') ? 1 : 0
    return { ...s, asset, score: durationScore + groupScore, bucket: Math.min(buckets - 1, Math.floor(s.offsetMs / windowMs)) }
  })

  // Sort by score descending within each user group
  const selected: SelectedAsset[] = []
  const userCounts = new Map<string, number>()

  const sortedScored = scored.sort((a, b) => b.score - a.score)
  for (const sub of sortedScored) {
    if (selected.length >= targetN) break
    const count = userCounts.get(sub.userId) ?? 0
    if (count >= maxPerUser) continue

    selected.push({
      assetId: sub.asset.id,
      submissionId: sub.id,
      userId: sub.userId,
      displayName: sub.displayName,
      assetType: sub.asset.assetType,
      storageKey: sub.asset.storageKey,
      createdAt: sub.createdAt,
      durationMs: sub.asset.durationMs ?? null,
    })
    userCounts.set(sub.userId, count + 1)
  }

  // Sort final selection by createdAt (chronological for reel playback)
  return selected.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

// ─── Recap computation ───────────────────────────────────────────────────────

async function computeRecap(eventId: string, log: FastifyBaseLogger): Promise<void> {
  log.info({ eventId }, 'recap-worker: starting computation')

  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) {
    log.warn({ eventId }, 'recap-worker: event not found')
    return
  }

  const eventDurationMs = event.endsAt.getTime() - event.startsAt.getTime()

  // Fetch all submissions with full asset + assignment data
  const rawSubmissions = await prisma.submission.findMany({
    where: { eventId, assets: { some: { status: 'uploaded' } } },
    include: {
      user: { include: { profile: true } },
      assets: { where: { status: 'uploaded' } },
      assignment: {
        include: {
          missionInstance: { include: { definition: { select: { title: true, category: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const submissions: SubmissionWithMeta[] = rawSubmissions.map((s) => ({
    id: s.id,
    userId: s.userId,
    displayName: s.user.profile?.displayName ?? s.userId,
    createdAt: s.createdAt,
    offsetMs: Math.max(0, s.createdAt.getTime() - event.startsAt.getTime()),
    assets: s.assets.map((a) => ({
      id: a.id,
      assetType: a.assetType,
      storageKey: a.storageKey,
      durationMs: a.durationMs,
    })),
    missionTitle: s.assignment.missionInstance.definition.title,
    category: s.assignment.missionInstance.definition.category,
  }))

  // ── Timeline recap: chapter every ~30 min ───────────────────────────────
  const CHAPTER_MS = 30 * 60_000
  const chapters: ChapterEntry[] = []
  let chapterIndex = 0

  for (const sub of submissions) {
    const chapterNum = Math.floor(sub.offsetMs / CHAPTER_MS)
    if (!chapters[chapterNum]) {
      chapters[chapterNum] = {
        chapterIndex: chapterNum,
        startsAtOffset: chapterNum * CHAPTER_MS,
        label: `${Math.floor((chapterNum * CHAPTER_MS) / 60_000)}–${Math.floor(((chapterNum + 1) * CHAPTER_MS) / 60_000)} min`,
        submissionIds: [],
      }
    }
    chapters[chapterNum]!.submissionIds.push(sub.id)
    chapterIndex = chapterNum
  }
  void chapterIndex

  // ── By-mission recap ────────────────────────────────────────────────────
  const missionInstances = await prisma.missionInstance.findMany({
    where: { eventId },
    include: { definition: { select: { title: true, category: true } } },
  })

  const byMission = missionInstances.map((inst) => ({
    missionInstanceId: inst.id,
    title: inst.definition.title,
    category: inst.definition.category,
    submissionIds: submissions
      .filter((s) =>
        rawSubmissions.some(
          (rs) => rs.id === s.id && rs.assignment.missionInstance.id === inst.id,
        ),
      )
      .map((s) => s.id),
  }))

  // ── By-participant recap ─────────────────────────────────────────────────
  const participants = await prisma.participant.findMany({
    where: { eventId, removedAt: null },
    include: { user: { include: { profile: true } } },
  })

  const byParticipant = participants.map((p) => ({
    userId: p.userId,
    displayName: p.user.profile?.displayName ?? p.userId,
    submissionIds: submissions.filter((s) => s.userId === p.userId).map((s) => s.id),
  }))

  // ── Collage selection (max 20 photos) ────────────────────────────────────
  const collageAssets = selectCollageAssets(submissions, 20, eventDurationMs)

  // ── Highlight reel selection (8-12 clips) ────────────────────────────────
  const highlightAssets = selectHighlightClips(submissions, eventDurationMs)

  // ── Upsert RecapArtifact, merging with existing reveal payload ────────────
  const existing = await prisma.recapArtifact.findUnique({ where: { eventId } })
  const existingPayload = (existing?.payload as Record<string, unknown>) ?? {}

  const recapPayload = JSON.parse(JSON.stringify({
    ...existingPayload,
    timeline: { chapters: chapters.filter(Boolean) },
    byMission,
    byParticipant,
    collage: { assets: collageAssets },
    highlight: { assets: highlightAssets },
  }))

  await prisma.recapArtifact.upsert({
    where: { eventId },
    create: { eventId, generatedAt: new Date(), payload: recapPayload },
    update: { generatedAt: new Date(), payload: recapPayload },
  })

  log.info(
    {
      eventId,
      chapters: chapters.filter(Boolean).length,
      collageCount: collageAssets.length,
      highlightCount: highlightAssets.length,
    },
    'recap-worker: computation complete',
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubmissionWithMeta {
  id: string
  userId: string
  displayName: string
  createdAt: Date
  offsetMs: number
  assets: { id: string; assetType: string; storageKey: string; durationMs: number | null }[]
  missionTitle: string
  category: string
}

interface SelectedAsset {
  assetId: string
  submissionId: string
  userId: string
  displayName: string
  assetType: string
  storageKey: string
  createdAt: Date
  durationMs?: number | null
}

interface ChapterEntry {
  chapterIndex: number
  startsAtOffset: number
  label: string
  submissionIds: string[]
}

// ─── Queue + Worker bootstrap ────────────────────────────────────────────────

let _queue: Queue | null = null

export function getRecapQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(RECAP_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
    })
  }
  return _queue
}

let _worker: Worker | null = null

export function startRecapWorker(log: FastifyBaseLogger): Worker {
  _worker = new Worker(
    RECAP_QUEUE,
    async (job: Job) => {
      const data = job.data as RecapJobData
      await computeRecap(data.eventId, log)
    },
    { connection: getRedis(), concurrency: 2 },
  )

  _worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'recap-worker: job failed')
  })

  log.info('recap-worker: started')
  return _worker
}

export async function stopRecapWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
}
