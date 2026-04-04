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

  // ── PUT /me (profile: displayName + bio) ─────────────────────────────────
  // Already handles displayName; extend to also accept bio here via the schema above.
  // The existing PUT / handler handles displayName — we extend it to also accept bio.

  // ── POST /me/avatar/confirm ───────────────────────────────────────────────
  // After uploading avatar to signed URL, call this to persist the storageKey on the profile.
  app.post('/avatar/confirm', async (request, reply) => {
    const userId = request.user.sub
    const schema = z.object({ storageKey: z.string().min(1) })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error' })

    const { storageKey } = body.data

    // Build the public URL for the avatar
    const { data: publicData } = supabaseAdmin.storage
      .from(env.STORAGE_BUCKET_MEDIA)
      .getPublicUrl(storageKey)

    const avatarUrl = publicData?.publicUrl ?? null

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, displayName: `User${userId.slice(0, 4)}`, avatarUrl: avatarUrl ?? null },
      update: { avatarUrl: avatarUrl ?? null },
    })

    return reply.status(200).send({ profile })
  })

  // ── PUT /me/profile ───────────────────────────────────────────────────────
  // Extended profile update: displayName + bio
  app.put('/profile', async (request, reply) => {
    const userId = request.user.sub
    const schema = z.object({
      displayName: z.string().min(1).max(50).optional(),
      bio:         z.string().max(200).optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })

    const update: Record<string, unknown> = {}
    if (body.data.displayName !== undefined) update.displayName = body.data.displayName
    if (body.data.bio !== undefined) update.bio = body.data.bio

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: body.data.displayName ?? `User${userId.slice(0, 4)}`,
        bio: body.data.bio ?? null,
      },
      update,
    })

    return reply.status(200).send({ profile })
  })

  // ── POST /me/change-password ──────────────────────────────────────────────
  // Sends a Twilio OTP for phone verification before allowing password change.
  app.post('/change-password/request', async (request, reply) => {
    const userId = request.user.sub
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.phone) return reply.status(400).send({ error: 'No phone number on account.' })

    const { error } = await supabaseAdmin.auth.signInWithOtp({ phone: user.phone })
    if (error) return reply.status(500).send({ error: 'Failed to send verification code.' })

    return reply.status(200).send({ ok: true, phone: user.phone })
  })

  // ── POST /me/change-password/verify ──────────────────────────────────────
  // Verifies the OTP and sets the new password.
  app.post('/change-password/verify', async (request, reply) => {
    const userId = request.user.sub
    const schema = z.object({
      token:       z.string().length(6),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      const first = body.error.issues[0]
      return reply.status(400).send({ error: first?.message ?? 'Validation error' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.phone) return reply.status(400).send({ error: 'No phone number on account.' })

    // Verify the OTP
    const { error: otpError } = await supabaseAdmin.auth.verifyOtp({
      phone: user.phone,
      token: body.data.token,
      type: 'sms',
    })
    if (otpError) return reply.status(401).send({ error: 'Invalid or expired verification code.' })

    // Set new password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: body.data.newPassword,
    })
    if (updateError) return reply.status(500).send({ error: 'Failed to update password.' })

    return reply.status(200).send({ ok: true })
  })

  // ── DELETE /me ────────────────────────────────────────────────────────────
  // Soft-deletes (anonymises) the user account.
  // Keeps DB structure intact but wipes PII and marks user as deleted.
  app.delete('/', async (request, reply) => {
    const userId = request.user.sub

    // Anonymise profile
    await prisma.profile.updateMany({
      where: { userId },
      data: {
        displayName: '[deleted]',
        bio: null,
        avatarUrl: null,
        expoPushToken: null,
      },
    })

    // Mark the user record as deleted (we keep the row for FK integrity)
    await prisma.user.update({
      where: { id: userId },
      data: { phone: null, email: null },
    })

    // Invalidate all Supabase sessions for this user
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId)
    } catch {
      // Best-effort — don't fail the request if Supabase delete fails
    }

    return reply.status(200).send({ ok: true })
  })
}
