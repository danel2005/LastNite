import type { FastifyInstance } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRecapQueue } from '../jobs/recap-worker.js'

export async function recapRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── GET /events/:id/recap ─────────────────────────────────────────────────
  // Returns structured recap artifacts.
  // Available to all participants once event is completed.
  // Returns 202 if still computing.
  app.get('/:id/recap', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be participant
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (event.state === 'processing') {
      return reply.status(202).send({ state: 'processing', message: 'Recap is still being computed.' })
    }
    if (event.state !== 'completed' && event.state !== 'archived') {
      return reply.status(409).send({ error: `Recap not available yet. Event state: ${event.state}` })
    }

    const recap = await prisma.recapArtifact.findUnique({ where: { eventId } })
    if (!recap) {
      return reply.status(202).send({ state: 'processing', message: 'Recap is still being computed.' })
    }

    const payload = recap.payload as Record<string, unknown>
    const timeline = payload['timeline'] ?? null
    const byMission = payload['byMission'] ?? null

    // Recap is considered ready once timeline is present
    if (!timeline) {
      // Trigger recap computation if not yet started
      const queue = getRecapQueue()
      await queue.add('compute-recap', { eventId }, { jobId: `recap-${eventId}`, delay: 0 })
      return reply.status(202).send({ state: 'processing', message: 'Recap computation started. Try again shortly.' })
    }

    return reply.status(200).send({
      eventId,
      generatedAt: recap.generatedAt,
      timeline,
      byMission,
      byParticipant: payload['byParticipant'] ?? null,
      collage: payload['collage'] ?? null,
      highlight: payload['highlight'] ?? null,
    })
  })
}
