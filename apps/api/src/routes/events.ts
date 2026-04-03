import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import { generateInviteCode } from '../lib/invite-code.js'
import { getTemplateConfig } from '../lib/event-templates.js'
import type { EventTemplate } from '@prisma/client'

const eventTemplateValues = [
  'house_party',
  'night_out',
  'birthday',
  'bachelor_bachelorette',
  'trip',
  'festival',
  'trek',
  'ski',
  'wedding',
  'costume_party',
] as const

const createEventSchema = z.object({
  title: z.string().min(1).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  template: z.enum(eventTemplateValues).optional(),
  missionIntervalMinutes: z.number().int().min(5).max(120).optional(),
  missionIntensity: z.number().int().min(1).max(5).optional(),
  allowCustomMissions: z.boolean().optional(),
  allowPublicSocialMissions: z.boolean().optional(),
  safeMode: z.boolean().optional(),
})

const updateEventSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  missionIntervalMinutes: z.number().int().min(5).max(120).optional(),
  missionIntensity: z.number().int().min(1).max(5).optional(),
  allowCustomMissions: z.boolean().optional(),
  allowPublicSocialMissions: z.boolean().optional(),
  safeMode: z.boolean().optional(),
})

/** Generate a unique invite code with retry logic */
async function generateUniqueInviteCode(maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode(8)
    const existing = await prisma.event.findUnique({ where: { inviteCode: code } })
    if (!existing) return code
  }
  throw new Error('Failed to generate unique invite code after max attempts')
}

export async function eventRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── POST /events ─────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const userId = request.user.sub
    const body = createEventSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const {
      title,
      startsAt: startsAtStr,
      endsAt: endsAtStr,
      template = 'house_party',
    } = body.data

    const startsAt = new Date(startsAtStr)
    const endsAt = new Date(endsAtStr)

    if (endsAt <= startsAt) {
      return reply.status(400).send({ error: 'endsAt must be after startsAt' })
    }

    const config = getTemplateConfig(template as EventTemplate)
    const inviteCode = await generateUniqueInviteCode()

    // Build event create data, using template defaults when not specified
    const event = await prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          title,
          hostId: userId,
          state: 'scheduled',
          template: template as EventTemplate,
          startsAt,
          endsAt,
          inviteCode,
          missionIntervalMinutes: body.data.missionIntervalMinutes ?? config.defaultMissionIntervalMinutes,
          missionIntensity: body.data.missionIntensity ?? config.defaultMissionIntensity,
          allowCustomMissions: body.data.allowCustomMissions ?? true,
          allowPublicSocialMissions: body.data.allowPublicSocialMissions ?? config.defaultAllowPublicSocial,
          safeMode: body.data.safeMode ?? config.defaultSafeMode,
        },
      })

      // Create Participant row for host
      await tx.participant.create({
        data: {
          eventId: newEvent.id,
          userId,
          isHost: true,
        },
      })

      // Activate packs for this template
      if (config.packSlugs.length > 0) {
        const packs = await tx.missionPack.findMany({
          where: { slug: { in: config.packSlugs } },
          select: { id: true },
        })
        if (packs.length > 0) {
          await tx.eventMissionPack.createMany({
            data: packs.map((p) => ({ eventId: newEvent.id, packId: p.id })),
            skipDuplicates: true,
          })
        }
      }

      return newEvent
    })

    return reply.status(201).send({ event })
  })

  // ── GET /events ───────────────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const userId = request.user.sub

    const participations = await prisma.participant.findMany({
      where: { userId, removedAt: null },
      include: {
        event: true,
      },
      orderBy: { event: { startsAt: 'desc' } },
    })

    const events = participations
      .filter((p) => !p.event.deletedAt)
      .map((p) => ({ ...p.event, isHost: p.isHost }))

    return reply.status(200).send({ events })
  })

  // ── GET /events/:id ───────────────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params as { id: string }

    const event = await prisma.event.findFirst({
      where: { id, deletedAt: null },
      include: {
        participants: {
          where: { removedAt: null },
          include: { user: { include: { profile: true } } },
        },
        activePacks: { include: { pack: true } },
      },
    })

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' })
    }

    // Must be a participant or host
    const isParticipant = event.participants.some((p) => p.userId === userId)
    if (!isParticipant) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    return reply.status(200).send({ event })
  })

  // ── PUT /events/:id ───────────────────────────────────────────────────────
  app.put('/:id', async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params as { id: string }
    const body = updateEventSchema.safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== userId) return reply.status(403).send({ error: 'Forbidden' })
    if (event.state !== 'draft' && event.state !== 'scheduled') {
      return reply.status(409).send({ error: 'Event can only be updated in draft or scheduled state' })
    }

    const updateData: Record<string, unknown> = {}
    if (body.data.title !== undefined) updateData['title'] = body.data.title
    if (body.data.startsAt !== undefined) updateData['startsAt'] = new Date(body.data.startsAt)
    if (body.data.endsAt !== undefined) updateData['endsAt'] = new Date(body.data.endsAt)
    if (body.data.missionIntervalMinutes !== undefined) updateData['missionIntervalMinutes'] = body.data.missionIntervalMinutes
    if (body.data.missionIntensity !== undefined) updateData['missionIntensity'] = body.data.missionIntensity
    if (body.data.allowCustomMissions !== undefined) updateData['allowCustomMissions'] = body.data.allowCustomMissions
    if (body.data.allowPublicSocialMissions !== undefined) updateData['allowPublicSocialMissions'] = body.data.allowPublicSocialMissions
    if (body.data.safeMode !== undefined) updateData['safeMode'] = body.data.safeMode

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
    })

    return reply.status(200).send({ event: updated })
  })

  // ── DELETE /events/:id ────────────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    await prisma.event.update({
      where: { id },
      data: { state: 'cancelled', deletedAt: new Date() },
    })

    return reply.status(200).send({ ok: true })
  })

  // ── POST /events/:id/invites ──────────────────────────────────────────────
  app.post('/:id/invites', async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    // Return existing invite or create new one
    const existing = await prisma.invite.findFirst({
      where: { eventId: id, createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      return reply.status(200).send({ invite: existing, inviteCode: existing.code })
    }

    // Generate a unique invite code for the invite table
    let code: string
    let attempts = 0
    do {
      code = generateInviteCode(8)
      const exists = await prisma.invite.findUnique({ where: { code } })
      if (!exists) break
      attempts++
    } while (attempts < 10)

    const invite = await prisma.invite.create({
      data: {
        eventId: id,
        code: code!,
        createdByUserId: userId,
      },
    })

    return reply.status(201).send({ invite, inviteCode: invite.code })
  })

  // ── GET /events/:id/participants ──────────────────────────────────────────
  app.get('/:id/participants', async (request, reply) => {
    const userId = request.user.sub
    const { id } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be participant
    const selfParticipant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    })
    if (!selfParticipant || selfParticipant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const participants = await prisma.participant.findMany({
      where: { eventId: id, removedAt: null },
      include: { user: { include: { profile: true } } },
      orderBy: { joinedAt: 'asc' },
    })

    return reply.status(200).send({ participants })
  })

  // ── DELETE /events/:id/participants/:userId ────────────────────────────────
  app.delete('/:id/participants/:targetUserId', async (request, reply) => {
    const requestUserId = request.user.sub
    const { id, targetUserId } = request.params as { id: string; targetUserId: string }

    const event = await prisma.event.findFirst({ where: { id, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.hostId !== requestUserId) return reply.status(403).send({ error: 'Forbidden' })

    if (targetUserId === requestUserId) {
      return reply.status(400).send({ error: 'Host cannot remove themselves' })
    }

    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId: id, userId: targetUserId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(404).send({ error: 'Participant not found' })
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: { removedAt: new Date() },
    })

    return reply.status(200).send({ ok: true })
  })
}

// ── POST /invites/:code/join ───────────────────────────────────────────────
export async function inviteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.post('/:code/join', async (request, reply) => {
    const userId = request.user.sub
    const { code } = request.params as { code: string }

    // Look up invite first; also check event's own invite code
    const invite = await prisma.invite.findUnique({ where: { code } })

    let eventId: string

    if (invite) {
      eventId = invite.eventId
    } else {
      // Check if it's the event's own inviteCode
      const event = await prisma.event.findFirst({ where: { inviteCode: code, deletedAt: null } })
      if (!event) {
        return reply.status(404).send({ error: 'Invalid invite code' })
      }
      eventId = event.id
    }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    if (event.state === 'cancelled') {
      return reply.status(409).send({ error: 'Event is cancelled' })
    }
    if (event.state === 'completed' || event.state === 'archived') {
      return reply.status(409).send({ error: 'Event has already ended' })
    }

    // Check if already a participant
    const existing = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })

    if (existing) {
      if (existing.removedAt) {
        // Re-join: un-remove them
        await prisma.participant.update({
          where: { id: existing.id },
          data: { removedAt: null },
        })
        return reply.status(200).send({ event, message: 'Rejoined event' })
      }
      return reply.status(200).send({ event, message: 'Already a participant' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.participant.create({
        data: { eventId, userId, isHost: false },
      })
      if (invite) {
        await tx.invite.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        })
      }
    })

    return reply.status(201).send({ event, message: 'Joined event' })
  })
}
