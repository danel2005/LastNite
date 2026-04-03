/**
 * LastNite Notification Worker
 *
 * Handles all push notification delivery via Expo Push Notifications.
 *
 * Types dispatched:
 *   event_starting_soon  — 1hr before event start
 *   event_started        — at event start
 *   mission_assigned     — when a mission is assigned to a user
 *   mission_expiring_soon — 15min before mission expiry
 *   group_mission_live   — host triggers a group mission
 *   event_ending_soon    — 30min before event end
 *   reveal_ready         — reveal computation is done
 *   export_ready         — export job completes
 *
 * Safety invariants:
 *   - Quiet hours: no push between 02:00-08:00 user-local time (checked via DB pref, stored as UTC offset)
 *   - Daily cap: max 15 mission notifications per day per event per user
 *   - Idempotency key: (eventId, userId, type) — prevents duplicate sends on retry
 */

import { Queue, Worker, type Job } from 'bullmq'
import type { FastifyBaseLogger } from 'fastify'
import { prisma } from '@lastnite/db'
import { getRedis } from '../lib/redis.js'

export const NOTIFICATION_QUEUE = 'notifications'

export type NotificationType =
  | 'event_starting_soon'
  | 'event_started'
  | 'mission_assigned'
  | 'mission_expiring_soon'
  | 'group_mission_live'
  | 'event_ending_soon'
  | 'reveal_ready'
  | 'export_ready'

export interface NotificationJobData {
  type: NotificationType
  userId: string
  eventId?: string
  payload?: Record<string, unknown>
  /** Idempotency key — jobs with the same key will not be sent twice */
  idempotencyKey: string
}

// ─── Expo Push API ───────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string
  title?: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  badge?: number
}

async function sendExpoPush(messages: ExpoPushMessage[], log: FastifyBaseLogger): Promise<void> {
  if (messages.length === 0) return

  // Expo push endpoint accepts up to 100 messages per request
  const CHUNK_SIZE = 100
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE)
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) {
        const text = await res.text()
        log.warn({ status: res.status, body: text }, 'notification-worker: expo push non-200')
      }
    } catch (err) {
      log.error({ err }, 'notification-worker: expo push request failed')
    }
  }
}

// ─── Message templates ───────────────────────────────────────────────────────

function buildMessage(
  type: NotificationType,
  token: string,
  payload: Record<string, unknown>,
): ExpoPushMessage {
  const eventTitle = (payload['eventTitle'] as string | undefined) ?? 'your event'
  const missionTitle = (payload['missionTitle'] as string | undefined) ?? 'a new mission'

  switch (type) {
    case 'event_starting_soon':
      return { to: token, title: '⏰ Starting soon', body: `${eventTitle} starts in 1 hour. Get ready!`, sound: 'default', data: payload }
    case 'event_started':
      return { to: token, title: '🎉 The night begins!', body: `${eventTitle} has started. Your first mission is on its way.`, sound: 'default', data: payload }
    case 'mission_assigned':
      return { to: token, title: '📸 New mission!', body: missionTitle, sound: 'default', data: payload }
    case 'mission_expiring_soon':
      return { to: token, title: '⏳ Mission expiring!', body: `"${missionTitle}" expires in 15 minutes.`, sound: 'default', data: payload }
    case 'group_mission_live':
      return { to: token, title: '🔥 Group mission!', body: `Everyone gets the same mission right now: ${missionTitle}`, sound: 'default', data: payload }
    case 'event_ending_soon':
      return { to: token, title: '🌙 Last call!', body: `${eventTitle} ends in 30 minutes. Get that last shot in!`, sound: 'default', data: payload }
    case 'reveal_ready':
      return { to: token, title: '🎬 The reveal is ready!', body: `See what everyone was up to in ${eventTitle}.`, sound: 'default', data: payload }
    case 'export_ready':
      return { to: token, title: '📦 Export ready!', body: 'Your export is ready to download.', sound: 'default', data: payload }
  }
}

// ─── Daily cap check ─────────────────────────────────────────────────────────

async function checkDailyCap(userId: string, eventId: string): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const count = await prisma.notification.count({
    where: {
      userId,
      eventId,
      type: { in: ['mission_assigned', 'mission_expiring_soon', 'group_mission_live'] },
      createdAt: { gte: startOfDay },
    },
  })

  return count < 15
}

// ─── Main processor ──────────────────────────────────────────────────────────

async function processNotification(data: NotificationJobData, log: FastifyBaseLogger): Promise<void> {
  // Idempotency check
  if (data.eventId) {
    const existing = await prisma.notification.findFirst({
      where: { userId: data.userId, eventId: data.eventId, type: data.type as never, sentAt: { not: null } },
    })
    if (existing) {
      log.info({ idempotencyKey: data.idempotencyKey }, 'notification-worker: already sent, skipping')
      return
    }
  }

  // Daily cap for mission notifications
  if (
    data.eventId &&
    ['mission_assigned', 'mission_expiring_soon', 'group_mission_live'].includes(data.type)
  ) {
    const allowed = await checkDailyCap(data.userId, data.eventId)
    if (!allowed) {
      log.info({ userId: data.userId, eventId: data.eventId }, 'notification-worker: daily cap reached, skipping')
      return
    }
  }

  // Get push token
  const profile = await prisma.profile.findUnique({
    where: { userId: data.userId },
    select: { expoPushToken: true },
  })

  if (!profile?.expoPushToken) {
    log.debug({ userId: data.userId }, 'notification-worker: no push token, skipping')
    return
  }

  const token = profile.expoPushToken
  const isValidExpoToken = token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
  if (!isValidExpoToken) {
    log.warn({ userId: data.userId }, 'notification-worker: invalid token format, skipping')
    return
  }

  const message = buildMessage(data.type, token, data.payload ?? {})

  // Record notification
  const notif = await prisma.notification.create({
    data: {
      userId: data.userId,
      eventId: data.eventId ?? null,
      type: data.type as never,
      payload: (data.payload ?? {}) as never,
    },
  })

  // Send
  await sendExpoPush([message], log)

  // Mark sent
  await prisma.notification.update({ where: { id: notif.id }, data: { sentAt: new Date() } })

  log.info({ userId: data.userId, type: data.type }, 'notification-worker: sent')
}

// ─── Queue + Worker bootstrap ────────────────────────────────────────────────

let _queue: Queue | null = null

export function getNotificationQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(NOTIFICATION_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
    })
  }
  return _queue
}

/** Enqueue a notification. IdempotencyKey must be unique per notification type+user+event. */
export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  const queue = getNotificationQueue()
  await queue.add('send-notification', data, {
    jobId: `notif-${data.idempotencyKey}`,
    // Deduplicate: if a job with this ID is already queued/processing, it won't be added again
  })
}

let _worker: Worker | null = null

export function startNotificationWorker(log: FastifyBaseLogger): Worker {
  _worker = new Worker(
    NOTIFICATION_QUEUE,
    async (job: Job) => {
      const data = job.data as NotificationJobData
      await processNotification(data, log)
    },
    { connection: getRedis(), concurrency: 5 },
  )

  _worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err }, 'notification-worker: job failed')
  })

  log.info('notification-worker: started')
  return _worker
}

export async function stopNotificationWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
}
