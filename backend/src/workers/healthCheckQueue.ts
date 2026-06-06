import { Queue } from 'bullmq'

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
}

export interface HealthCheckJob {
  endpointId: string
  url: string
  method: string
  headers?: object
  body?: object
  expectedStatus: number[]
  timeout: number
  expectedBodyContains?: string
}

export const healthCheckQueue = new Queue<HealthCheckJob, void, 'check'>('health-checks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000,
    },
  },
})
