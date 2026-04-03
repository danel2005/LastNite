import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import { getExportQueue } from '../jobs/export-worker.js'

const createExportSchema = z.object({
  type: z.enum(['photo_pack', 'highlight_reel']),
})

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── POST /events/:id/export ──────────────────────────────────────────────
  // Create an export job (photo_pack or highlight_reel).
  // Participants only; event must be completed/archived.
  app.post('/events/:id/export', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const body = createExportSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    if (event.state !== 'completed' && event.state !== 'archived') {
      return reply.status(409).send({ error: 'Export only available after event completes.' })
    }

    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Create export job
    const job = await prisma.exportJob.create({
      data: {
        eventId,
        requestedByUserId: userId,
        type: body.data.type,
        status: 'pending',
      },
    })

    // Enqueue
    const queue = getExportQueue()
    await queue.add('process-export', { exportJobId: job.id }, { jobId: `export-${job.id}` })

    return reply.status(201).send({
      jobId: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
    })
  })
}

export async function exportJobRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── GET /export-jobs/:id ─────────────────────────────────────────────────
  // Poll export job status.
  app.get('/:id', async (request, reply) => {
    const userId = request.user.sub
    const { id: jobId } = request.params as { id: string }

    const job = await prisma.exportJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.status(404).send({ error: 'Export job not found' })

    if (job.requestedByUserId !== userId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    return reply.status(200).send({
      jobId: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    })
  })

  // ── GET /export-jobs/:id/download ────────────────────────────────────────
  // Returns the download payload once job is ready.
  app.get('/:id/download', async (request, reply) => {
    const userId = request.user.sub
    const { id: jobId } = request.params as { id: string }

    const job = await prisma.exportJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.status(404).send({ error: 'Export job not found' })

    if (job.requestedByUserId !== userId) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (job.status !== 'ready') {
      return reply.status(409).send({ error: `Export not ready. Status: ${job.status}` })
    }

    return reply.status(200).send(job.resultPayload)
  })
}
