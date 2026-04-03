import IORedis from 'ioredis'
import { env } from './env.js'

let _redis: IORedis | null = null

export function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    })
  }
  return _redis
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
}
