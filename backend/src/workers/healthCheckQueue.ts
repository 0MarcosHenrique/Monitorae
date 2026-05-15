import { Queue } from 'bullmq'
import Redis from 'ioredis'

// URL de conexão usando o environment REDIS_URL
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })

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

// Configuração da fila BullMQ
export const healthCheckQueue = new Queue<HealthCheckJob>('health-checks', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 1000
    }
  }
})
