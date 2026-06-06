import { Job, Worker } from 'bullmq'
import { HealthCheckJob, redisConnection } from './healthCheckQueue'
import { processEndpointHealthCheck } from '../services/healthCheckRunner'

const log = {
  success: (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
}

export const healthCheckWorker = new Worker<HealthCheckJob>('health-checks', async (job: Job<HealthCheckJob>) => {
  const data = job.data
  const processed = await processEndpointHealthCheck({
    id: data.endpointId,
    url: data.url,
    method: data.method,
    headers: data.headers,
    body: data.body,
    expectedStatus: data.expectedStatus,
    timeout: data.timeout,
    expectedBodyContains: data.expectedBodyContains || null,
  })

  if (!processed) {
    log.warn(`Endpoint ${data.endpointId} does not exist or is inactive.`)
    return
  }

  if (processed.previousStatus && processed.previousStatus !== processed.currentStatus) {
    log.warn(`Status changed from ${processed.previousStatus} to ${processed.currentStatus} (${data.url})`)
  }

  if (processed.result.isUp) {
    log.success(`${data.url} -> [${processed.result.statusCode}] ${processed.result.latency.toFixed(2)}ms`)
  } else {
    log.error(`${data.url} -> [${processed.result.statusCode || 'FAILED'}] ${processed.result.errorMessage}`)
  }
}, { connection: redisConnection })
