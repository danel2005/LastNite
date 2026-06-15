import type { FastifyInstance } from 'fastify'
import { prisma } from '@lastnite/db'
import { isAdminRequest } from '../lib/admin.js'

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  app.get('/events', async (request, reply) => {
    if (!isAdminRequest(request)) {
      return reply.status(403).send({ error: 'Admin only' })
    }

    const events = await prisma.event.findMany({
      where: { deletedAt: null },
      include: {
        host: { include: { profile: true } },
        participants: {
          where: { removedAt: null },
          include: { user: { include: { profile: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        missionInstances: {
          include: {
            definition: true,
            assignments: {
              include: {
                user: { include: { profile: true } },
                submission: { include: { assets: true } },
              },
              orderBy: { assignedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { startsAt: 'desc' },
    })

    return reply.status(200).send({ events })
  })
}
