import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'

let app: FastifyInstance | null = null

afterEach(async () => {
  if (app) {
    await app.close()
    app = null
  }
})

describe('buildApp', () => {
  it('serves the health endpoint without starting background jobs', async () => {
    app = await buildApp({ startBackgroundServices: false })

    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', service: 'lastnite-api' })
  })

  it('protects authenticated API routes', async () => {
    app = await buildApp({ startBackgroundServices: false })

    const res = await app.inject({ method: 'GET', url: '/me' })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'Unauthorized' })
  })
})
