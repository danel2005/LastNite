import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import { supabaseAdmin } from '../lib/supabase.js'
import { env } from '../lib/env.js'

const VALID_EMOJIS = ['fire', 'heart', 'laugh', 'wow'] as const
type EmojiKey = (typeof VALID_EMOJIS)[number]

const emojiMap: Record<EmojiKey, string> = {
  fire: '🔥',
  heart: '❤️',
  laugh: '😂',
  wow: '😮',
}

const addReactionSchema = z.object({
  emoji: z.enum(VALID_EMOJIS),
})

/**
 * Generate a signed read URL for a storage key.
 * We create short-lived signed URLs server-side so the mobile client
 * never needs the service_role key or direct bucket access.
 */
async function signedReadUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(env.STORAGE_BUCKET_MEDIA)
    .createSignedUrl(storageKey, 3600) // 1 hour
  if (error || !data) return null
  return data.signedUrl
}

export async function feedRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── GET /events/:id/feed ──────────────────────────────────────────────────
  // Paginated feed with signed media URLs. This is the canonical feed endpoint.
  // During live event: mission titles/categories are hidden.
  // After event ends: mission titles shown.
  app.get('/:id/feed', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const isEventOver = event.state === 'completed' || event.state === 'archived'

    const { cursor, limit: limitStr } = request.query as { cursor?: string; limit?: string }
    const limit = Math.min(Number(limitStr ?? 20), 50)

    const submissions = await prisma.submission.findMany({
      where: {
        eventId,
        assets: { some: { status: 'uploaded' } },
      },
      include: {
        user: { include: { profile: true } },
        assets: {
          where: { status: 'uploaded' },
          select: {
            id: true,
            storageKey: true,
            assetType: true,
            widthPx: true,
            heightPx: true,
            durationMs: true,
          },
        },
        assignment: {
          include: {
            missionInstance: {
              include: {
                definition: { select: { title: true, category: true } },
              },
            },
          },
        },
        reactions: {
          where: { userId },
          select: { id: true, emoji: true },
        },
        _count: { select: { reactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = submissions.length > limit
    if (hasMore) submissions.pop()

    // Generate signed read URLs for all assets in parallel
    const items = await Promise.all(
      submissions.map(async (s) => {
        const assetsWithUrls = await Promise.all(
          s.assets.map(async (a) => ({
            id: a.id,
            assetType: a.assetType,
            widthPx: a.widthPx,
            heightPx: a.heightPx,
            durationMs: a.durationMs,
            url: await signedReadUrl(a.storageKey),
          })),
        )

        return {
          id: s.id,
          createdAt: s.createdAt,
          user: {
            id: s.userId,
            displayName: s.user.profile?.displayName ?? 'Unknown',
            avatarKey: s.user.profile?.avatarStorageKey ?? null,
          },
          assets: assetsWithUrls,
          reactionCount: s._count.reactions,
          myReaction: s.reactions[0]
            ? { id: s.reactions[0].id, emoji: s.reactions[0].emoji }
            : null,
          // Mission info only after event ends
          missionTitle: isEventOver
            ? s.assignment.missionInstance.definition.title
            : null,
          missionCategory: isEventOver
            ? s.assignment.missionInstance.definition.category
            : null,
        }
      }),
    )

    return reply.status(200).send({
      items,
      nextCursor: hasMore ? submissions[submissions.length - 1]?.id ?? null : null,
      hasMore,
    })
  })

  // ── POST /submissions/:submissionId/reactions ─────────────────────────────
  app.post('/submissions/:submissionId/reactions', async (request, reply) => {
    const userId = request.user.sub
    const { submissionId } = request.params as { submissionId: string }

    const body = addReactionSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    })
    if (!submission) return reply.status(404).send({ error: 'Submission not found' })

    // Must be a participant in this event
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId: submission.eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const emoji = emojiMap[body.data.emoji]

    // Upsert: one reaction per user per submission (replace if different emoji)
    const reaction = await prisma.reaction.upsert({
      where: { submissionId_userId: { submissionId, userId } },
      create: { submissionId, userId, emoji },
      update: { emoji },
    })

    // Denormalized count update (reaction count on submission) — we derive from DB
    // No separate counter needed since we always query _count.reactions

    return reply.status(201).send({ reaction })
  })

  // ── DELETE /submissions/:submissionId/reactions/:reactionId ───────────────
  app.delete('/submissions/:submissionId/reactions/:reactionId', async (request, reply) => {
    const userId = request.user.sub
    const { submissionId, reactionId } = request.params as {
      submissionId: string
      reactionId: string
    }

    const reaction = await prisma.reaction.findUnique({ where: { id: reactionId } })
    if (!reaction) return reply.status(404).send({ error: 'Reaction not found' })
    if (reaction.submissionId !== submissionId) {
      return reply.status(400).send({ error: 'Reaction does not belong to this submission' })
    }
    if (reaction.userId !== userId) return reply.status(403).send({ error: 'Forbidden' })

    await prisma.reaction.delete({ where: { id: reactionId } })

    return reply.status(200).send({ ok: true })
  })

  // ── GET /submissions/:submissionId/reactions ──────────────────────────────
  app.get('/submissions/:submissionId/reactions', async (request, reply) => {
    const userId = request.user.sub
    const { submissionId } = request.params as { submissionId: string }

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } })
    if (!submission) return reply.status(404).send({ error: 'Submission not found' })

    // Must be participant in the event
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId: submission.eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const reactions = await prisma.reaction.findMany({
      where: { submissionId },
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const grouped = reactions.reduce<Record<string, { count: number; users: string[] }>>(
      (acc, r) => {
        const existing = acc[r.emoji] ?? { count: 0, users: [] }
        existing.count++
        existing.users.push(r.user.profile?.displayName ?? r.userId)
        acc[r.emoji] = existing
        return acc
      },
      {},
    )

    return reply.status(200).send({
      total: reactions.length,
      byEmoji: grouped,
      reactions: reactions.map((r) => ({
        id: r.id,
        emoji: r.emoji,
        userId: r.userId,
        displayName: r.user.profile?.displayName ?? 'Unknown',
        createdAt: r.createdAt,
      })),
    })
  })
}
