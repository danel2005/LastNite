import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import { supabaseAdmin } from '../lib/supabase.js'
import { env } from '../lib/env.js'
import type { SubmissionAssetType, MissionAssignmentStatus } from '@prisma/client'

const SIGNED_URL_EXPIRES_IN = 300 // 5 minutes to complete the upload

const initSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  assetType: z.enum(['photo', 'video']),
  mimeType: z.string().min(1).max(50),
  fileSizeBytes: z.number().int().positive().max(157_286_400), // 150 MB max
  // Optional metadata captured at shoot time
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
  capturedAt: z.string().datetime().optional(),
})

const confirmSubmissionSchema = z.object({
  fileSizeBytes: z.number().int().positive().optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  durationMs: z.number().int().positive().optional(),
  capturedAt: z.string().datetime().optional(),
})

function storageKey(eventId: string, userId: string, assetId: string, ext: string): string {
  return `events/${eventId}/${userId}/${assetId}.${ext}`
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/mov': 'mov',
  }
  return map[mimeType] ?? 'bin'
}

export async function submissionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── POST /events/:id/submissions/init ─────────────────────────────────────
  // Creates a Submission + SubmissionAsset shell, returns a signed upload URL.
  app.post('/:id/submissions/init', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const body = initSubmissionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { assignmentId, assetType, mimeType, fileSizeBytes } = body.data

    // Validate event
    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be participant
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Validate assignment belongs to this user + event
    const assignment = await prisma.missionAssignment.findUnique({
      where: { id: assignmentId },
    })
    if (!assignment) return reply.status(404).send({ error: 'Assignment not found' })
    if (assignment.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (assignment.eventId !== eventId) return reply.status(400).send({ error: 'Assignment does not belong to this event' })
    if (assignment.status !== 'active') {
      return reply.status(409).send({ error: `Assignment is ${assignment.status}, cannot submit` })
    }

    // Idempotency: if a Submission already exists for this assignment, return it
    const existingSubmission = await prisma.submission.findUnique({
      where: { assignmentId },
      include: { assets: true },
    })
    if (existingSubmission) {
      // If there's already an uploaded asset, reject duplicate
      const uploadedAsset = existingSubmission.assets.find((a) => a.status === 'uploaded')
      if (uploadedAsset) {
        return reply.status(409).send({ error: 'Submission already completed for this assignment' })
      }
      // Otherwise a pending upload exists — clean it up and re-issue
      await prisma.submissionAsset.deleteMany({ where: { submissionId: existingSubmission.id } })
      await prisma.submission.delete({ where: { id: existingSubmission.id } })
    }

    // File size limits
    if (assetType === 'photo' && fileSizeBytes > 15_728_640) {
      return reply.status(400).send({ error: 'Photo must be under 15 MB' })
    }
    if (assetType === 'video' && fileSizeBytes > 157_286_400) {
      return reply.status(400).send({ error: 'Video must be under 150 MB' })
    }

    // Create Submission + SubmissionAsset in a transaction
    const { submission, asset } = await prisma.$transaction(async (tx) => {
      const newSubmission = await tx.submission.create({
        data: { eventId, userId, assignmentId },
      })

      const ext = extFromMime(mimeType)
      const key = storageKey(eventId, userId, newSubmission.id, ext)

      const newAsset = await tx.submissionAsset.create({
        data: {
          submissionId: newSubmission.id,
          assetType: assetType as SubmissionAssetType,
          status: 'pending_upload',
          storageKey: key,
          mimeType,
          fileSizeBytes: BigInt(fileSizeBytes),
          widthPx: body.data.widthPx ?? null,
          heightPx: body.data.heightPx ?? null,
          durationMs: body.data.durationMs ?? null,
          capturedAt: body.data.capturedAt ? new Date(body.data.capturedAt) : null,
        },
      })

      return { submission: newSubmission, asset: newAsset }
    })

    // Generate signed upload URL from Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(env.STORAGE_BUCKET_MEDIA)
      .createSignedUploadUrl(asset.storageKey)

    if (uploadError || !uploadData) {
      // Rollback the submission rows
      await prisma.submissionAsset.delete({ where: { id: asset.id } })
      await prisma.submission.delete({ where: { id: submission.id } })
      return reply.status(500).send({ error: 'Failed to generate upload URL' })
    }

    return reply.status(201).send({
      submissionId: submission.id,
      assetId: asset.id,
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      storageKey: asset.storageKey,
      expiresInSeconds: SIGNED_URL_EXPIRES_IN,
    })
  })

  // ── POST /events/:id/submissions/:submissionId/confirm ────────────────────
  // Called after the client successfully uploads to Supabase Storage.
  app.post('/:id/submissions/:submissionId/confirm', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId, submissionId } = request.params as { id: string; submissionId: string }

    const body = confirmSubmissionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assets: true },
    })
    if (!submission) return reply.status(404).send({ error: 'Submission not found' })
    if (submission.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (submission.eventId !== eventId) return reply.status(400).send({ error: 'Submission does not belong to this event' })

    const asset = submission.assets[0]
    if (!asset) return reply.status(404).send({ error: 'No asset found for submission' })
    if (asset.status === 'uploaded') {
      return reply.status(200).send({ submission, asset, alreadyConfirmed: true })
    }

    // Mark asset as uploaded + update metadata if provided
    const updatedAsset = await prisma.submissionAsset.update({
      where: { id: asset.id },
      data: {
        status: 'uploaded',
        ...(body.data.fileSizeBytes != null && { fileSizeBytes: BigInt(body.data.fileSizeBytes) }),
        ...(body.data.widthPx != null && { widthPx: body.data.widthPx }),
        ...(body.data.heightPx != null && { heightPx: body.data.heightPx }),
        ...(body.data.durationMs != null && { durationMs: body.data.durationMs }),
        ...(body.data.capturedAt != null && { capturedAt: new Date(body.data.capturedAt) }),
      },
    })

    // Mark the assignment as completed
    await prisma.missionAssignment.update({
      where: { id: submission.assignmentId },
      data: {
        status: 'completed' as MissionAssignmentStatus,
        completedAt: new Date(),
      },
    })

    return reply.status(200).send({ submission, asset: updatedAsset })
  })

  // ── POST /events/:id/submissions/:submissionId/cancel ─────────────────────
  // Clean up if upload fails on the client side.
  app.post('/:id/submissions/:submissionId/cancel', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId, submissionId } = request.params as { id: string; submissionId: string }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assets: true },
    })
    if (!submission) return reply.status(404).send({ error: 'Submission not found' })
    if (submission.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (submission.eventId !== eventId) return reply.status(400).send({ error: 'Submission does not belong to this event' })

    const asset = submission.assets[0]
    if (asset?.status === 'uploaded') {
      return reply.status(409).send({ error: 'Cannot cancel a completed submission' })
    }

    // Attempt to delete from storage (best-effort)
    if (asset) {
      await supabaseAdmin.storage
        .from(env.STORAGE_BUCKET_MEDIA)
        .remove([asset.storageKey])
        .catch(() => {}) // ignore storage errors on cancel
    }

    // Delete DB rows
    await prisma.submissionAsset.deleteMany({ where: { submissionId } })
    await prisma.submission.delete({ where: { id: submissionId } })

    return reply.status(200).send({ ok: true })
  })
}
