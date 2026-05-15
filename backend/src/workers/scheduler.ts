import { healthCheckQueue, HealthCheckJob } from './healthCheckQueue'
import { prisma } from '../lib/prisma'

// Busca e adiciona os jobs para todos os endpoints ativos no BD
export const scheduleHealthChecks = async () => {
  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true }
  })

  console.log(`\x1b[36m[SCHEDULER]\x1b[0m Inicializando ${endpoints.length} jobs repetíveis...`)

  for (const ep of endpoints) {
    await addEndpointJob(ep)
  }
}

// Adiciona e gerencia um Job repetível para o respectivo endpoint
export const addEndpointJob = async (endpoint: any) => {
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

  // Importante limpar se já houver um job de repetição pré-existente (por exemplo, após alterar o intervalo num PUT)
  await removeEndpointJob(endpoint.id)

  await healthCheckQueue.add('check', jobData, {
    jobId, // Usado para identificar o job caso precisemos interagir posteriormente
    repeat: {
      every: endpoint.interval * 1000 // Multiplicando por 1000 pois BullMQ usa ms e o DB salva em segundos
    }
  })
}

// Remove o Job de um endpoint específico. Usado em Soft Deletes ou desativações.
export const removeEndpointJob = async (endpointId: string) => {
  const jobId = `health-check-${endpointId}`
  const repeatableJobs = await healthCheckQueue.getRepeatableJobs()
  
  const jobToRemove = repeatableJobs.find(job => job.id === jobId)
  
  if (jobToRemove) {
    await healthCheckQueue.removeRepeatableByKey(jobToRemove.key)
    console.log(`\x1b[33m[SCHEDULER]\x1b[0m Job repetível desativado para: ${endpointId}`)
  }
}
