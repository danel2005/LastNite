import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase.js'
import { prisma } from '@lastnite/db'

const requestOtpSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.phone ?? d.email, {
  message: 'Provide either phone or email',
})

const verifyOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  token: z.string().length(6),
  type: z.enum(['sms', 'email']),
})

export async function authRoutes(app: FastifyInstance) {
  // ── POST /auth/request-otp ────────────────────────────────────────────────
  app.post('/request-otp', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = requestOtpSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { phone, email } = body.data

    if (phone) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({ phone })
      if (error) {
        app.log.error({ err: error }, 'OTP send failed')
        return reply.status(500).send({ error: 'Failed to send OTP' })
      }
    } else if (email) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({ email })
      if (error) {
        app.log.error({ err: error }, 'Magic link send failed')
        return reply.status(500).send({ error: 'Failed to send magic link' })
      }
    }

    return reply.status(200).send({ ok: true })
  })

  // ── POST /auth/verify-otp ─────────────────────────────────────────────────
  app.post('/verify-otp', async (request, reply) => {
    const body = verifyOtpSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error', issues: body.error.issues })
    }

    const { phone, email, token } = body.data

    const { data, error } = await supabaseAdmin.auth.verifyOtp(
      phone
        ? { phone, token, type: 'sms' }
        : { email: email!, token, type: 'email' },
    )

    if (error || !data.session || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired OTP' })
    }

    const { user: supaUser, session } = data

    const user = await prisma.user.upsert({
      where: { id: supaUser.id },
      create: {
        id: supaUser.id,
        phone: supaUser.phone ?? null,
        email: supaUser.email ?? null,
      },
      update: {
        phone: supaUser.phone ?? null,
        email: supaUser.email ?? null,
      },
    })

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return reply.status(200).send({
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      },
      user: { id: user.id, phone: user.phone, email: user.email },
      profile: profile ?? null,
      isNewUser: profile === null,
    })
  })

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error' })
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: body.data.refreshToken,
    })

    if (error || !data.session) {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    return reply.status(200).send({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    })
  })
}
