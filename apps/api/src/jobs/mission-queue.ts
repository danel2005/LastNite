import { Queue } from 'bullmq'
import { getRedis } from '../lib/redis.js'

export type MissionJobName = 'dispatch' | 'expire' | 'finale'

export interface DispatchJobData {
  eventId: string
}

export interface ExpireJobData {
  eventId: string
}

export interface FinaleJobData {
  eventId: string
}

export type MissionJobData = DispatchJobData | ExpireJobData | FinaleJobData

export const MISSION_QUEUE = 'mission-dispatch'

let _queue: Queue | null = null

export function getMissionQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(MISSION_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
  }
  return _queue
}
