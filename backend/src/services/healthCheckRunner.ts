import Redis from 'ioredis'
import { prisma } from '../lib/prisma'
import { runHealthCheck } from './checker'
import { createAndDispatchAlerts } from './alertNotifier'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const publisher = new Redis(redisUrl, { maxRetriesPerRequest: null })

type HealthCheckEndpoint = {
  id: string
  url: string
  method: string
  headers?: unknown
  body?: unknown
  expectedStatus: number[]
  timeout: number
  expectedBodyContains?: string | null
}

const publishStatusChange = async (endpointId: string, status: string) => {
  await publisher.publish('endpoint-status-changed', JSON.stringify({
    endpointId,
    status,
  }))
}

export const processEndpointHealthCheck = async (endpoint: HealthCheckEndpoint) => {
  const result = await runHealthCheck({
    url: endpoint.url,
    method: endpoint.method,
    headers: endpoint.headers ? JSON.parse(JSON.stringify(endpoint.headers)) : undefined,
    body: endpoint.body ? JSON.parse(JSON.stringify(endpoint.body)) : undefined,
    timeout: endpoint.timeout,
    expectedStatus: endpoint.expectedStatus,
    expectedBodyContains: endpoint.expectedBodyContains || undefined,
  })

  const existing = await prisma.endpoint.findUnique({
    where: { id: endpoint.id },
    select: { currentStatus: true, isActive: true },
  })

  if (!existing || !existing.isActive) {
    return null
  }

  const previousStatus = existing.currentStatus
  const newStatus = result.isUp ? 'UP' : 'DOWN'
  const hasStatusChanged = previousStatus !== null && previousStatus !== newStatus

  const healthCheck = await prisma.healthCheck.create({
    data: {
      endpointId: endpoint.id,
      statusCode: result.statusCode,
      latency: result.latency,
      isUp: result.isUp,
      responseBody: result.responseBody,
      errorMessage: result.errorMessage,
    },
  })

  await prisma.endpoint.update({
    where: { id: endpoint.id },
    data: {
      currentStatus: newStatus,
      lastCheckedAt: new Date(),
    },
  })

  if (hasStatusChanged && newStatus === 'DOWN') {
    const message = `Endpoint ${endpoint.url} is DOWN. Error: ${result.errorMessage || result.statusCode}`

    await createAndDispatchAlerts({
      endpointId: endpoint.id,
      type: 'DOWN',
      message,
    })

    await prisma.incident.create({
      data: {
        endpointId: endpoint.id,
        startedAt: new Date(),
        errorCode: result.statusCode,
        errorMessage: result.errorMessage,
      },
    })

    await publishStatusChange(endpoint.id, newStatus)
  }

  if (hasStatusChanged && newStatus === 'UP') {
    await createAndDispatchAlerts({
      endpointId: endpoint.id,
      type: 'UP_AGAIN',
      message: `Endpoint ${endpoint.url} recovered.`,
    })

    const lastIncident = await prisma.incident.findFirst({
      where: {
        endpointId: endpoint.id,
        resolvedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    if (lastIncident) {
      const resolvedAt = new Date()
      const duration = Math.floor((resolvedAt.getTime() - lastIncident.startedAt.getTime()) / 1000)

      await prisma.incident.update({
        where: { id: lastIncident.id },
        data: {
          resolvedAt,
          duration,
        },
      })
    }

    await publishStatusChange(endpoint.id, newStatus)
  }

  return {
    healthCheck,
    result,
    previousStatus,
    currentStatus: newStatus,
  }
}
