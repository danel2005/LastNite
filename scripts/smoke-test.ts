import { randomUUID } from 'node:crypto'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001'
const ACCESS_TOKEN = process.env['ACCESS_TOKEN']

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  if (ACCESS_TOKEN) headers.set('authorization', `Bearer ${ACCESS_TOKEN}`)

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${text}`)
  }

  return body
}

async function main() {
  const suffix = randomUUID().slice(0, 8)
  console.info(`Smoke target: ${API_URL}`)

  const health = await request('/health')
  console.info('health:', health)

  if (!ACCESS_TOKEN) {
    console.info('ACCESS_TOKEN not set; authenticated smoke steps skipped.')
    console.info('Set ACCESS_TOKEN to a Supabase user JWT to run event/invite flows.')
    return
  }

  const startsAt = new Date(Date.now() + 60_000).toISOString()
  const endsAt = new Date(Date.now() + 3_600_000).toISOString()
  const created = await request('/events', {
    method: 'POST',
    body: JSON.stringify({
      title: `Smoke Event ${suffix}`,
      startsAt,
      endsAt,
      template: 'house_party',
    }),
  })
  console.info('created event:', created.event.id)

  const invite = await request(`/events/${created.event.id}/invites`, { method: 'POST' })
  console.info('invite code:', invite.inviteCode)

  const detail = await request(`/events/${created.event.id}`)
  console.info('participants:', detail.event.participants.length)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
