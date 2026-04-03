import type { FastifyInstance } from 'fastify'
import { prisma } from '@lastnite/db'

/**
 * Live event endpoints.
 *
 * PRIVACY INVARIANT: Mission assignment data for other participants is NEVER
 * returned while the event is live. Participants can only see:
 *   - Who is "active" (lastActiveAt + submission count)
 *   - Their own missions (see /my-missions)
 *   - The shared submission feed (media only, mission title hidden until completed)
 */
export async function liveEventRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── GET /events/:id/live ──────────────────────────────────────────────────
  // The main polling endpoint for live events.
  // Recommended poll interval: 30s (10s when a mission is about to expire).
  app.get('/:id/live', async (request, reply) => {
    const userId = request.user.sub
    const { id: eventId } = request.params as { id: string }

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    // Must be participant
    const participant = await prisma.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
    })
    if (!participant || participant.removedAt) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    // Touch lastActiveAt for this participant
    await prisma.participant.update({
      where: { id: participant.id },
      data: { lastActiveAt: new Date() },
    })

    const now = new Date()
    const timeRemainingMs = Math.max(0, event.endsAt.getTime() - now.getTime())

    // ── Active missions for the current user (ONLY this user) ────────────────
    const myActiveAssignments = await prisma.missionAssignment.findMany({
      where: { eventId, userId, status: { in: ['active', 'pending'] } },
      include: {
        missionInstance: { include: { definition: true } },
        submission: { select: { id: true } },
      },
      orderBy: { assignedAt: 'desc' },
    })

    const myMissions = myActiveAssignments.map((a) => ({
      assignmentId: a.id,
      status: a.status,
      isSecret: a.isSecret,
      assignedAt: a.assignedAt,
      expiresAt: a.expiresAt,
      completedAt: a.completedAt,
      hasSubmission: !!a.submission,
      mission: {
        id: a.missionInstance.definition.id,
        title: a.missionInstance.definition.title,
        description: a.missionInstance.definition.description,
        mediaType: a.missionInstance.definition.mediaType,
        intensity: a.missionInstance.definition.intensity,
        minDurationMs: a.missionInstance.definition.minDurationMs,
        maxDurationMs: a.missionInstance.definition.maxDurationMs,
      },
    }))

    // ── Participant activity summary (NO mission data) ────────────────────────
    const allParticipants = await prisma.participant.findMany({
      where: { eventId, removedAt: null },
      include: { user: { include: { profile: true } } },
    })

    const submissionCounts = await prisma.submission.groupBy({
      by: ['userId'],
      where: { eventId },
      _count: { id: true },
    })
    const submissionCountMap = new Map(submissionCounts.map((s) => [s.userId, s._count.id]))

    const participantActivity = allParticipants.map((p) => ({
      userId: p.userId,
      displayName: p.user.profile?.displayName ?? 'Unknown',
      avatarKey: p.user.profile?.avatarStorageKey ?? null,
      isHost: p.isHost,
      submissionCount: submissionCountMap.get(p.userId) ?? 0,
      lastActiveAt: p.lastActiveAt,
      isOnline: p.lastActiveAt
        ? now.getTime() - p.lastActiveAt.getTime() < 2 * 60_000 // active in last 2 minutes
        : false,
    }))

    // ── Host-only: completion rate summary ───────────────────────────────────
    let hostData: {
      completionRates: { userId: string; total: number; completed: number }[]
    } | null = null

    if (participant.isHost) {
      const allAssignments = await prisma.missionAssignment.groupBy({
        by: ['userId', 'status'],
        where: { eventId },
        _count: { id: true },
      })

      const byUser = new Map<string, { total: number; completed: number }>()
      for (const row of allAssignments) {
        const entry = byUser.get(row.userId) ?? { total: 0, completed: 0 }
        entry.total += row._count.id
        if (row.status === 'completed') entry.completed += row._count.id
        byUser.set(row.userId, entry)
      }

      hostData = {
        completionRates: Array.from(byUser.entries()).map(([uid, data]) => ({
          userId: uid,
          total: data.total,
          completed: data.completed,
        })),
      }
    }

    return reply.status(200).send({
      event: {
        id: event.id,
        title: event.title,
        state: event.state,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timeRemainingMs,
        missionIntervalMinutes: event.missionIntervalMinutes,
        template: event.template,
      },
      myMissions,
      participants: participantActivity,
      hostData,
      pollHint: {
        // Suggest faster polling if a mission is expiring soon
        intervalMs:
          myMissions.some(
            (m) => m.expiresAt && m.expiresAt.getTime() - now.getTime() < 10 * 60_000,
          )
            ? 10_000
            : 30_000,
      },
    })
  })

  // ── GET /events/:id/feed ──────────────────────────────────────────────────
  // Chronological submission feed. Mission titles are HIDDEN while live.
  // After event ends they're visible (handled by /events/:id/feed in step 08).
  // This is the live-only version — minimal payload.
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
          select: { id: true, storageKey: true, assetType: true, widthPx: true, heightPx: true },
        },
        assignment: {
          include: {
            missionInstance: { include: { definition: { select: { title: true, category: true } } } },
          },
        },
        _count: { select: { reactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = submissions.length > limit
    if (hasMore) submissions.pop()

    const items = submissions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      user: {
        id: s.userId,
        displayName: s.user.profile?.displayName ?? 'Unknown',
        avatarKey: s.user.profile?.avatarStorageKey ?? null,
      },
      assets: s.assets,
      reactionCount: s._count.reactions,
      // Mission title only visible after event ends
      missionTitle: isEventOver
        ? s.assignment.missionInstance.definition.title
        : null,
      missionCategory: isEventOver
        ? s.assignment.missionInstance.definition.category
        : null,
    }))

    return reply.status(200).send({
      items,
      nextCursor: hasMore ? submissions[submissions.length - 1]?.id ?? null : null,
      hasMore,
    })
  })
}
