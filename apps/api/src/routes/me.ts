import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@lastnite/db'
import { supabaseAdmin } from '../lib/supabase.js'
import { env } from '../lib/env.js'

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
})

export async function meRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate)

  // ── GET /me ───────────────────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const userId = request.user.sub

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return reply.status(200).send({
      id: user.id,
      phone: user.phone,
      email: user.email,
      profile: user.profile ?? null,
    })
  })

  // ── PUT /me ───────────────────────────────────────────────────────────────
  app.put('/', async (request, reply) => {
    const userId = request.user.sub
    const body = updateProfileSchema.safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { displayName } = body.data

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: displayName ?? `User${userId.slice(0, 4)}`,
      },
      update: {
        ...(displayName !== undefined ? { displayName } : {}),
      },
    })

    return reply.status(200).send({ profile })
  })

  // ── POST /me/avatar ───────────────────────────────────────────────────────
  app.post('/avatar', async (request, reply) => {
    const userId = request.user.sub
    const storageKey = `avatars/${userId}/avatar.jpg`

    const { data, error } = await supabaseAdmin.storage
      .from(env.STORAGE_BUCKET_MEDIA)
      .createSignedUploadUrl(storageKey)

    if (error || !data) {
      app.log.error({ err: error }, 'Failed to create avatar upload URL')
      return reply.status(500).send({ error: 'Failed to create upload URL' })
    }

    return reply.status(200).send({ uploadUrl: data.signedUrl, storageKey })
  })

  // ── PUT /me/push-token ────────────────────────────────────────────────────
  app.put('/push-token', async (request, reply) => {
    const userId = request.user.sub
    const body = z.object({ token: z.string().min(1) }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error' })
    }

    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: `User${userId.slice(0, 4)}`,
        expoPushToken: body.data.token,
      },
      update: { expoPushToken: body.data.token },
    })

    return reply.status(200).send({ ok: true })
  })

  // ── GET /me/preferences ───────────────────────────────────────────────────
  app.get('/preferences', async (request, reply) => {
    const userId = request.user.sub
    const prefs = await prisma.userMissionPreference.findUnique({ where: { userId } })

    return reply.status(200).send(
      prefs ?? { disablePublicSocial: false, disableAlcoholRefs: false, disableIntensityAbove: null },
    )
  })

  // ── PUT /me/preferences ───────────────────────────────────────────────────
  app.put('/preferences', async (request, reply) => {
    const userId = request.user.sub

    const schema = z.object({
      disablePublicSocial: z.boolean().optional(),
      disableAlcoholRefs: z.boolean().optional(),
      disableIntensityAbove: z.number().int().min(1).max(5).nullable().optional(),
    })

    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    // Build explicit update objects to satisfy exactOptionalPropertyTypes
    const createData = {
      userId,
      disablePublicSocial: body.data.disablePublicSocial ?? false,
      disableAlcoholRefs: body.data.disableAlcoholRefs ?? false,
      disableIntensityAbove: body.data.disableIntensityAbove ?? null,
    }

    const updateData = {
      ...(body.data.disablePublicSocial !== undefined && { disablePublicSocial: body.data.disablePublicSocial }),
      ...(body.data.disableAlcoholRefs !== undefined && { disableAlcoholRefs: body.data.disableAlcoholRefs }),
      ...(body.data.disableIntensityAbove !== undefined && { disableIntensityAbove: body.data.disableIntensityAbove }),
    }

    const prefs = await prisma.userMissionPreference.upsert({
      where: { userId },
      create: createData,
      update: updateData,
    })

    return reply.status(200).send({ preferences: prefs })
  })
}
