import type { FastifyInstance } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRevealQueue } from '../jobs/reveal-worker.js'

export async function revealRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── POST /events/:id/close ────────────────────────────────────────────────
  // Host closes the event early (or auto-close is triggered by the scheduler).
  // Transitions live/ending → processing, enqueues reveal computation.
  app.post('/:id/close', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    if (!['live', 'ending', 'scheduled'].includes(event.state)) {
      return reply
        .status(409)
        .send({ error: `Event cannot be closed from state: ${event.state}` })
    }

    // Transition → processing
    await prisma.event.update({
      where: { id: eventId },
      data: { state: 'processing' },
    })

    // Enqueue reveal computation job
    const queue = getRevealQueue()
    await queue.add('compute-reveal', { eventId })

    return reply.status(202).send({ ok: true, message: 'Event closed. Reveal is being computed...' })
  })

  // ── GET /events/:id/reveal ────────────────────────────────────────────────
  // Returns the full reveal payload. Only available once event.state = 'completed'.
  app.get('/:id/reveal', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be a participant
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    if (event.state === 'processing') {
      return reply.status(202).send({ state: 'processing', message: 'Reveal is still being computed. Try again shortly.' })
    }

    if (event.state !== 'completed' && event.state !== 'archived') {
      return reply.status(409).send({ error: `Reveal not available yet. Event state: ${event.state}` })
    }

    const recap = await prisma.recapArtifact.findUnique({ where: { eventId } })
    if (!recap) {
      return reply.status(202).send({ state: 'processing', message: 'Reveal is still being computed.' })
    }

    const payload = recap.payload as Record<string, unknown>
    const reveal = payload['reveal'] as {
      missions: unknown[]
      awards: unknown[]
      stats: unknown
    } | null

    if (!reveal) {
      return reply.status(202).send({ state: 'processing', message: 'Reveal is still being computed.' })
    }

    return reply.status(200).send({
      eventId,
      generatedAt: recap.generatedAt,
      missions: reveal.missions,
      awards: reveal.awards,
      stats: reveal.stats,
    })
  })
}
