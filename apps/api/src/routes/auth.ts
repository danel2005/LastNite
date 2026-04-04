/**
 * Auth routes
 *
 * Supports two auth modes:
 *   1. Phone + password (primary, new)
 *      POST /auth/signup          — create account, sends OTP for verification
 *      POST /auth/verify-signup   — verify OTP after signup → returns session
 *      POST /auth/resend-signup-otp — resend verification OTP
 *      POST /auth/signin          — sign in with phone + password (no OTP needed)
 *      POST /auth/forgot-password — request OTP for password reset
 *      POST /auth/verify-reset    — verify reset OTP → returns short-lived resetToken
 *      POST /auth/reset-password  — set new password using resetToken
 *
 *   2. Legacy OTP-only (kept for backward compatibility)
 *      POST /auth/request-otp
 *      POST /auth/verify-otp
 *
 *   Both modes:
 *      POST /auth/refresh
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase.js'
import { prisma } from '@lastnite/db'

// ─── Shared schemas ───────────────────────────────────────────────────────────

const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format (e.g. +972501234567)')

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

// ─── Helper: upsert user record after Supabase auth ──────────────────────────

async function upsertUser(supaUser: { id: string; phone?: string | null; email?: string | null }) {
  return prisma.user.upsert({
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
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/signup ───────────────────────────────────────────────────��─
  // Creates account with phone + password; Supabase sends an OTP for phone verification.
  app.post('/signup', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({ phone: phoneSchema, password: passwordSchema })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      const first = body.error.issues[0]
      return reply.status(400).send({ error: first?.message ?? 'Validation error' })
    }

    const { phone, password } = body.data

    const { error } = await supabaseAdmin.auth.signUp({ phone, password })
    if (error) {
      app.log.error({ err: error }, 'Signup failed')
      const status = error.status === 400 ? 400 : 500
      // Make user-friendly messages
      const msg = error.message?.toLowerCase().includes('already registered')
        ? 'An account with this number already exists.'
        : (error.message ?? 'Signup failed')
      return reply.status(status).send({ error: msg })
    }

    return reply.status(200).send({ ok: true })
  })

  // ── POST /auth/verify-signup ──────────────────────────────────────────────
  // Verifies the OTP sent during signup. Returns a session token.
  app.post('/verify-signup', async (request, reply) => {
    const schema = z.object({ phone: phoneSchema, token: z.string().length(6) })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Validation error' })
    }

    const { phone, token } = body.data
    const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone, token, type: 'sms' })

    if (error || !data.session || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired verification code.' })
    }

    const user = await upsertUser(data.user)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return reply.status(200).send({
      session: { accessToken: data.session.access_token },
      user: { id: user.id, phone: user.phone, email: user.email },
      profile: profile ?? null,
    })
  })

  // ── POST /auth/resend-signup-otp ──────────────────────────────────────────
  app.post('/resend-signup-otp', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({ phone: phoneSchema })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid phone number' })

    const { error } = await supabaseAdmin.auth.resend({ phone: body.data.phone, type: 'sms' })
    if (error) return reply.status(500).send({ error: 'Failed to resend code' })
    return reply.status(200).send({ ok: true })
  })

  // ── POST /auth/signin ─────────────────────────────────────────────────────
  // Sign in with phone + password. No OTP required for returning users.
  app.post('/signin', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({ phone: phoneSchema, password: passwordSchema })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      const first = body.error.issues[0]
      return reply.status(400).send({ error: first?.message ?? 'Validation error' })
    }

    const { phone, password } = body.data
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ phone, password })

    if (error || !data.session || !data.user) {
      // Don't reveal whether the account exists
      return reply.status(401).send({ error: 'Invalid phone number or password.' })
    }

    const user = await upsertUser(data.user)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return reply.status(200).send({
      session: { accessToken: data.session.access_token },
      user: { id: user.id, phone: user.phone, email: user.email },
      profile: profile ?? null,
    })
  })

  // ── POST /auth/forgot-password ────────────────────────────────────────────
  // Sends an OTP to the phone for password reset.
  app.post('/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({ phone: phoneSchema })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Invalid phone number' })

    const { phone } = body.data

    // Check account exists before sending OTP (safer UX)
    const existingUser = await prisma.user.findFirst({ where: { phone } })
    if (!existingUser) {
      return reply.status(404).send({ error: 'No account found for this number.' })
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({ phone })
    if (error) {
      app.log.error({ err: error }, 'Reset OTP send failed')
      return reply.status(500).send({ error: 'Failed to send reset code.' })
    }

    return reply.status(200).send({ ok: true })
  })

  // ── POST /auth/verify-reset ───────────────────────────────────────────────
  // Verifies the reset OTP and returns an access token to use for password update.
  app.post('/verify-reset', async (request, reply) => {
    const schema = z.object({ phone: phoneSchema, token: z.string().length(6) })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error' })

    const { phone, token } = body.data
    const { data, error } = await supabaseAdmin.auth.verifyOtp({ phone, token, type: 'sms' })

    if (error || !data.session || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired code.' })
    }

    // Return the access token as a "resetToken" — the client uses it in /auth/reset-password
    return reply.status(200).send({
      resetToken: data.session.access_token,
    })
  })

  // ── POST /auth/reset-password ─────────────────────────────────────────────
  // Uses a reset token (from verify-reset) to set a new password.
  app.post('/reset-password', async (request, reply) => {
    const schema = z.object({
      phone: phoneSchema,
      resetToken: z.string().min(10),
      password: passwordSchema,
    })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      const first = body.error.issues[0]
      return reply.status(400).send({ error: first?.message ?? 'Validation error' })
    }

    const { password, resetToken } = body.data

    // Use the reset token to authenticate and update the password
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(resetToken)
    if (userError || !userData.user) {
      return reply.status(401).send({ error: 'Reset token is invalid or expired.' })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password },
    )
    if (updateError) {
      app.log.error({ err: updateError }, 'Password update failed')
      return reply.status(500).send({ error: 'Failed to update password.' })
    }

    // Sign the user in with their new password
    const phone = body.data.phone
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      phone,
      password,
    })
    if (signInError || !signInData.session || !signInData.user) {
      return reply.status(500).send({ error: 'Password updated but failed to sign in. Please try signing in manually.' })
    }

    const user = await upsertUser(signInData.user)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return reply.status(200).send({
      session: { accessToken: signInData.session.access_token },
      user: { id: user.id, phone: user.phone, email: user.email },
      profile: profile ?? null,
    })
  })

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error' })

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

  // ── Legacy: POST /auth/request-otp ───────────────────────────────────────
  // Kept for backward compatibility. New code uses /signin or /signup.
  app.post('/request-otp', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const schema = z.object({
      phone: phoneSchema.optional(),
      email: z.string().email().optional(),
    }).refine((d) => d.phone ?? d.email, { message: 'Provide either phone or email' })

    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error' })

    const { phone, email } = body.data
    if (phone) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({ phone })
      if (error) return reply.status(500).send({ error: error.message ?? 'Failed to send OTP' })
    } else if (email) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({ email })
      if (error) return reply.status(500).send({ error: error.message ?? 'Failed to send magic link' })
    }

    return reply.status(200).send({ ok: true })
  })

  // ── Legacy: POST /auth/verify-otp ────────────────────────────────────────
  app.post('/verify-otp', async (request, reply) => {
    const schema = z.object({
      phone: z.string().optional(),
      email: z.string().email().optional(),
      token: z.string().length(6),
      type: z.enum(['sms', 'email']),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: 'Validation error' })

    const { phone, email, token } = body.data
    const { data, error } = await supabaseAdmin.auth.verifyOtp(
      phone
        ? { phone, token, type: 'sms' }
        : { email: email!, token, type: 'email' },
    )

    if (error || !data.session || !data.user) {
      return reply.status(401).send({ error: 'Invalid or expired OTP' })
    }

    const user = await upsertUser(data.user)
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } })

    return reply.status(200).send({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
      user: { id: user.id, phone: user.phone, email: user.email },
      profile: profile ?? null,
      isNewUser: profile === null,
    })
  })
}
