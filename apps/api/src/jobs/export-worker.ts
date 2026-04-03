import { Queue, Worker, type Job } from 'bullmq'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import { supabaseAdmin } from '../lib/supabase.js'
import { env } from '../lib/env.js'
import { getRedis } from '../lib/redis.js'

export const EXPORT_QUEUE = 'export-jobs'

export interface ExportJobData {
  exportJobId: string
}

// ─── Signed URL helper ───────────────────────────────────────────────────────

async function getSignedUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(env.STORAGE_BUCKET_MEDIA)
    .createSignedUrl(storageKey, 3600 * 24) // 24h

  if (error || !data) return null
  return data.signedUrl
}

// ─── Export handlers ─────────────────────────────────────────────────────────

async function processPhotoPack(
  exportJobId: string,
  eventId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  log.info({ exportJobId, eventId }, 'export-worker: building photo_pack')

  const assets = await prisma.submissionAsset.findMany({
    where: {
      submission: { eventId },
      assetType: 'photo',
      status: 'uploaded',
      moderationStatus: { not: 'removed' },
    },
    include: {
      submission: {
        include: { user: { include: { profile: true } }, assignment: { include: { missionInstance: { include: { definition: { select: { title: true } } } } } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const urls = await Promise.all(
    assets.map(async (a) => {
      const url = await getSignedUrl(a.storageKey)
      return {
        assetId: a.id,
        submissionId: a.submissionId,
        url,
        mimeType: a.mimeType,
        fileSizeBytes: a.fileSizeBytes?.toString() ?? null,
        widthPx: a.widthPx,
        heightPx: a.heightPx,
        capturedAt: a.capturedAt,
        submitterName: a.submission.user.profile?.displayName ?? a.submission.userId,
        missionTitle: a.submission.assignment.missionInstance.definition.title,
      }
    }),
  )

  const updatedJob = await prisma.exportJob.update({
    where: { id: exportJobId },
    data: {
      status: 'ready',
      completedAt: new Date(),
      resultPayload: { type: 'photo_pack', photos: urls.filter((u) => u.url !== null) },
    },
  })

  // Notify requester
  const { enqueueNotification } = await import('./notification-worker.js')
  await enqueueNotification({
    type: 'export_ready',
    userId: updatedJob.requestedByUserId,
    eventId: updatedJob.eventId,
    payload: { exportJobId, eventId: updatedJob.eventId },
    idempotencyKey: `export_ready-${exportJobId}`,
  }).catch(() => {})

  log.info({ exportJobId, count: urls.length }, 'export-worker: photo_pack complete')
}

async function processHighlightReel(
  exportJobId: string,
  eventId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  log.info({ exportJobId, eventId }, 'export-worker: building highlight_reel')

  // Use the recap artifact's highlight selection if available
  const recap = await prisma.recapArtifact.findUnique({ where: { eventId } })
  const highlightAssetIds: string[] = recap
    ? ((recap.payload as Record<string, unknown>)['highlight'] as { assets?: { assetId: string }[] })?.assets?.map((a) => a.assetId) ?? []
    : []

  let assets
  if (highlightAssetIds.length > 0) {
    assets = await prisma.submissionAsset.findMany({
      where: { id: { in: highlightAssetIds }, status: 'uploaded', moderationStatus: { not: 'removed' } },
      include: {
        submission: { include: { user: { include: { profile: true } } } },
      },
    })
    // Preserve recap ordering
    assets.sort((a, b) => highlightAssetIds.indexOf(a.id) - highlightAssetIds.indexOf(b.id))
  } else {
    // Fallback: all videos ordered by time
    assets = await prisma.submissionAsset.findMany({
      where: {
        submission: { eventId },
        assetType: 'video',
        status: 'uploaded',
        moderationStatus: { not: 'removed' },
      },
      include: {
        submission: { include: { user: { include: { profile: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 12,
    })
  }

  const clips = await Promise.all(
    assets.map(async (a, idx) => {
      const url = await getSignedUrl(a.storageKey)
      return {
        order: idx + 1,
        assetId: a.id,
        submissionId: a.submissionId,
        url,
        mimeType: a.mimeType,
        durationMs: a.durationMs,
        capturedAt: a.capturedAt,
        submitterName: a.submission.user.profile?.displayName ?? a.submission.userId,
      }
    }),
  )

  const updatedReelJob = await prisma.exportJob.update({
    where: { id: exportJobId },
    data: {
      status: 'ready',
      completedAt: new Date(),
      resultPayload: { type: 'highlight_reel', clips: clips.filter((c) => c.url !== null) },
    },
  })

  // Notify requester
  const { enqueueNotification } = await import('./notification-worker.js')
  await enqueueNotification({
    type: 'export_ready',
    userId: updatedReelJob.requestedByUserId,
    eventId: updatedReelJob.eventId,
    payload: { exportJobId, eventId: updatedReelJob.eventId },
    idempotencyKey: `export_ready-${exportJobId}`,
  }).catch(() => {})

  log.info({ exportJobId, count: clips.length }, 'export-worker: highlight_reel complete')
}

// ─── Main processor ──────────────────────────────────────────────────────────

async function processExportJob(exportJobId: string, log: FastifyBaseLogger): Promise<void> {
  const job = await prisma.exportJob.findUnique({ where: { id: exportJobId } })
  if (!job) {
    log.warn({ exportJobId }, 'export-worker: job not found')
    return
  }

  if (job.status !== 'pending' && job.status !== 'processing') {
    log.info({ exportJobId, status: job.status }, 'export-worker: job already completed, skipping')
    return
  }

  await prisma.exportJob.update({ where: { id: exportJobId }, data: { status: 'processing' } })

  try {
    if (job.type === 'photo_pack') {
      await processPhotoPack(exportJobId, job.eventId, log)
    } else {
      await processHighlightReel(exportJobId, job.eventId, log)
    }
  } catch (err) {
    log.error({ exportJobId, err }, 'export-worker: job failed')
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}

// ─── Queue + Worker bootstrap ────────────────────────────────────────────────

let _queue: Queue | null = null

export function getExportQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(EXPORT_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
    })
  }
  return _queue
}

let _worker: Worker | null = null

export function startExportWorker(log: FastifyBaseLogger): Worker {
  _worker = new Worker(
    EXPORT_QUEUE,
    async (job: Job) => {
      const data = job.data as ExportJobData
      await processExportJob(data.exportJobId, log)
    },
    { connection: getRedis(), concurrency: 2 },
  )

  _worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'export-worker: job failed')
  })

  log.info('export-worker: started')
  return _worker
}

export async function stopExportWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
}
