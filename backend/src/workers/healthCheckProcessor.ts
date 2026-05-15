import { Worker, Job } from 'bullmq'
import { prisma } from '../lib/prisma'
import { runHealthCheck } from '../services/checker'
import { HealthCheckJob } from './healthCheckQueue'
import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })

// Utilitário para formatar logs com cores ANSI no console
const log = {
  info: (msg: string) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
}

// Inicializa e exporta o Worker
export const healthCheckWorker = new Worker<HealthCheckJob>('health-checks', async (job: Job<HealthCheckJob>) => {
  const data = job.data
  
  // 1. Faz requisição com axios (serviço puro)
  const result = await runHealthCheck({
    url: data.url,
    method: data.method,
    headers: data.headers,
    body: data.body,
    timeout: data.timeout,
    expectedStatus: data.expectedStatus,
    expectedBodyContains: data.expectedBodyContains,
  })

  // 2. Busca status atual no banco para comparação
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: data.endpointId },
    select: { currentStatus: true }
  })

  if (!endpoint) {
    log.warn(`Endpoint ${data.endpointId} foi deletado ou não existe. O job deveria ser removido.`)
    return
  }

  const previousStatus = endpoint.currentStatus
  const newStatus = result.isUp ? 'UP' : 'DOWN'
  const hasStatusChanged = previousStatus !== null && previousStatus !== newStatus

  // 3. Salva log do HealthCheck no banco
  await prisma.healthCheck.create({
    data: {
      endpointId: data.endpointId,
      statusCode: result.statusCode,
      latency: result.latency,
      isUp: result.isUp,
      responseBody: result.responseBody,
      errorMessage: result.errorMessage,
    }
  })

  // 4. Atualiza o status recente do Endpoint
  await prisma.endpoint.update({
    where: { id: data.endpointId },
    data: {
      currentStatus: newStatus,
      lastCheckedAt: new Date()
    }
  })

  // 5. Lógica de reatividade com Alertas e WebSocket pub/sub se o status mudou
  if (hasStatusChanged) {
    log.warn(`⚠️ Status do endpoint mudou de ${previousStatus} para ${newStatus} (${data.url})`)

    if (newStatus === 'DOWN') {
      // Cria alerta do tipo DOWN
      await prisma.alert.create({
        data: {
          endpointId: data.endpointId,
          type: 'DOWN',
          channel: 'EMAIL',
          message: `Endpoint ${data.url} caiu! Erro: ${result.errorMessage || result.statusCode}`,
        }
      })

      // Inicia um Incidente
      await prisma.incident.create({
        data: {
          endpointId: data.endpointId,
          startedAt: new Date(),
          errorCode: result.statusCode,
          errorMessage: result.errorMessage
        }
      })

      // Dispara evento pub/sub do redis para ser capturado pelos sockets conectados
      connection.publish('endpoint-status-changed', JSON.stringify({
        endpointId: data.endpointId,
        status: newStatus,
      }))
    }

    if (newStatus === 'UP') {
      // Cria alerta de recuperação
      await prisma.alert.create({
        data: {
          endpointId: data.endpointId,
          type: 'UP_AGAIN',
          channel: 'EMAIL',
          message: `Endpoint ${data.url} voltou ao normal.`,
        }
      })

      // Busca o último incidente ainda não resolvido desse endpoint
      const lastIncident = await prisma.incident.findFirst({
        where: {
          endpointId: data.endpointId,
          resolvedAt: null
        },
        orderBy: {
          startedAt: 'desc'
        }
      })

      if (lastIncident) {
        const resolvedAt = new Date()
        // Duração em segundos
        const duration = Math.floor((resolvedAt.getTime() - lastIncident.startedAt.getTime()) / 1000)
        
        await prisma.incident.update({
          where: { id: lastIncident.id },
          data: {
            resolvedAt,
            duration
          }
        })
      }

      connection.publish('endpoint-status-changed', JSON.stringify({
        endpointId: data.endpointId,
        status: newStatus,
      }))
    }
  }

  // Console Logs da checagem
  if (result.isUp) {
    log.success(`${data.url} -> [${result.statusCode}] ${result.latency.toFixed(2)}ms`)
  } else {
    log.error(`${data.url} -> [${result.statusCode || 'FALHA'}] ${result.errorMessage}`)
  }

}, { connection })
