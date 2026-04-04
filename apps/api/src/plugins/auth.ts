import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'

export interface JwtPayload {
  sub: string
  email?: string
  phone?: string
  role: string
  iat: number
  exp: number
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('user', null)

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing token' })
    }
    const token = authHeader.slice(7)
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
    request.user = {
      sub: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      role: 'authenticated',
      iat: 0,
      exp: 0,
    }
  })
}

export default fp(authPlugin, { name: 'auth' })

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
