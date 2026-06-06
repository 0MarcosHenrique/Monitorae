import { Endpoint } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { HealthCheckJob, healthCheckQueue } from './healthCheckQueue'

export const scheduleHealthChecks = async () => {
  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
  })

  console.log(`[SCHEDULER] Scheduling ${endpoints.length} active endpoint jobs...`)

  for (const endpoint of endpoints) {
    await addEndpointJob(endpoint)
  }
}

export const addEndpointJob = async (endpoint: Endpoint) => {
  const jobId = `health-check-${endpoint.id}`
  const jobData: HealthCheckJob = {
    endpointId: endpoint.id,
    url: endpoint.url,
    method: endpoint.method,
    headers: endpoint.headers ? JSON.parse(JSON.stringify(endpoint.headers)) : undefined,
    body: endpoint.body ? JSON.parse(JSON.stringify(endpoint.body)) : undefined,
    expectedStatus: endpoint.expectedStatus,
    timeout: endpoint.timeout,
    expectedBodyContains: endpoint.expectedBodyContains || undefined,
  }

  await removeEndpointJob(endpoint.id)

  await healthCheckQueue.add('check', jobData, {
    jobId,
    repeat: {
      every: endpoint.interval * 1000,
    },
  })

  console.log(`[SCHEDULER] Job scheduled for endpoint ${endpoint.id}`)
}

export const removeEndpointJob = async (endpointId: string) => {
  const jobId = `health-check-${endpointId}`
  const repeatableJobs = await healthCheckQueue.getRepeatableJobs()
  const jobToRemove = repeatableJobs.find((job) => job.id === jobId)

  if (!jobToRemove) {
    return
  }

  await healthCheckQueue.removeRepeatableByKey(jobToRemove.key)
  console.log(`[SCHEDULER] Job removed for endpoint ${endpointId}`)
}
