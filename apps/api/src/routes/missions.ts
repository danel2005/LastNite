import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import type { MissionMediaType } from '@prisma/client'

const mediaTypeValues = ['photo', 'video', 'any'] as const

const createCustomMissionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  mediaType: z.enum(mediaTypeValues).default('any'),
  isSecret: z.boolean().default(false),
  targetUserId: z.string().uuid().optional(),
  assignToAll: z.boolean().default(false),
})

export async function missionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── POST /events/:id/missions/custom ─────────────────────────────────────
  app.post('/:id/missions/custom', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const body = createCustomMissionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be a participant
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Only host or participant can create custom missions, and only if event allows it
    if (!event.allowCustomMissions && !participant.isHost) {
      return reply.status(403).send({ error: 'Custom missions are disabled for this event' })
    }

    // Missions are locked once the event starts — can only be added before it goes live
    if (event.state === 'live' || event.state === 'ending') {
      return reply.status(409).send({ error: 'Mission creation is locked once the event has started.' })
    }
    if (event.state === 'completed' || event.state === 'archived' || event.state === 'cancelled') {
      return reply.status(409).send({ error: 'Cannot create missions for a finished event.' })
    }

    const { title, description, mediaType, isSecret, targetUserId, assignToAll } = body.data

    // Validate targetUserId is a participant
    if (targetUserId) {
      const targetParticipant = await prisma.participant.findUnique({
        where: { eventId_userId: { eventId, userId: targetUserId } },
      })
      if (!targetParticipant || targetParticipant.removedAt) {
        return reply.status(400).send({ error: 'targetUserId must be an active participant' })
      }
    }

    // Create the custom MissionDefinition
    const definition = await prisma.missionDefinition.create({
      data: {
        title,
        description,
        category: 'custom',
        mediaType: mediaType as MissionMediaType,
        intensity: 3,
        isSocial: false,
        defaultIsSecret: isSecret,
        isSystem: false,
        createdByUserId: userId,
        eventId,
        targetUserId: targetUserId ?? null,
      },
    })

    // Immediately create a MissionInstance for this event
    const instance = await prisma.missionInstance.create({
      data: { eventId, definitionId: definition.id },
    })

    // If assignToAll (or targetUserId means assign to that user, or just queue for next dispatch)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + event.missionIntervalMinutes * 60_000)

    if (assignToAll) {
      // Assign to all active participants immediately
      const participants = await prisma.participant.findMany({
        where: { eventId, removedAt: null },
      })
      await prisma.missionAssignment.createMany({
        data: participants.map((p) => ({
          missionInstanceId: instance.id,
          eventId,
          userId: p.userId,
          isSecret,
          status: 'active' as const,
          expiresAt,
        })),
        skipDuplicates: true,
      })
    } else if (targetUserId) {
      // Assign only to the target user
      await prisma.missionAssignment.create({
        data: {
          missionInstanceId: instance.id,
          eventId,
          userId: targetUserId,
          isSecret,
          status: 'active',
          expiresAt,
        },
      })
    }
    // If neither assignToAll nor targetUserId: the definition is in the pool, next dispatch tick will assign it

    return reply.status(201).send({ definition, instance })
  })

  // ── GET /events/:id/my-missions ───────────────────────────────────────────
  // PRIVACY INVARIANT: returns ONLY the current user's assignments. Never another user's.
  app.get('/:id/my-missions', async (request, reply) => {
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

    const assignments = await prisma.missionAssignment.findMany({
      where: { eventId, userId },
      include: {
        missionInstance: {
          include: {
            definition: true,
          },
        },
        submission: {
          include: { assets: { select: { id: true, storageKey: true, assetType: true } } },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })

    return reply.status(200).send({ assignments })
  })

  // ── POST /events/:id/missions/:assignmentId/skip ──────────────────────────
  app.post('/:id/missions/:assignmentId/skip', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId, assignmentId } = request.params as { id: string; assignmentId: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Check skip is enabled (host-configurable — for now always allowed; future: event.allowSkip)
    const assignment = await prisma.missionAssignment.findUnique({
      where: { id: assignmentId },
    })
    if (!assignment) return reply.status(404).send({ error: 'Assignment not found' })
    if (assignment.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (assignment.eventId !== eventId) return reply.status(400).send({ error: 'Assignment does not belong to this event' })
    if (assignment.status !== 'active') {
      return reply.status(409).send({ error: `Cannot skip: assignment is ${assignment.status}` })
    }

    await prisma.missionAssignment.update({
      where: { id: assignmentId },
      data: { status: 'skipped', skippedAt: new Date() },
    })

    return reply.status(200).send({ ok: true })
  })

  // ── POST /events/:id/missions/trigger ─────────────────────────────────────
  // Host triggers an immediate group mission for all participants
  app.post('/:id/missions/trigger', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (event.state !== 'live') return reply.status(409).send({ error: 'Event is not live' })

    // Import scheduleEventMissions lazily to avoid circular at startup
    const { getMissionQueue } = await import('../jobs/mission-queue.js')
    const queue = getMissionQueue()
    await queue.add('dispatch', { eventId }, { delay: 0 })

    return reply.status(202).send({ ok: true, message: 'Mission dispatch triggered' })
  })
}
