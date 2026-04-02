import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { env } from '../lib/env.js'

// Supabase JWTs contain a `sub` (userId) and `role` claim
export interface JwtPayload {
  sub: string   // Supabase auth.users.id — matches our User.id
  email?: string
  phone?: string
  role: string  // 'authenticated' for logged-in users
  iat: number
  exp: number
}

// Tell @fastify/jwt what the decoded token shape is
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.SUPABASE_JWT_SECRET,
  })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })
}

export default fp(authPlugin, { name: 'auth' })

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
