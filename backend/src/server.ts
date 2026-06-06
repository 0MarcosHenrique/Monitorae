import Fastify from 'fastify'
import cors from '@fastify/cors'
import { endpointRoutes } from './routes/endpoints'
import './workers/healthCheckProcessor'
import { scheduleHealthChecks } from './workers/scheduler'

const server = Fastify({
  logger: true,
})

server.register(cors, {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
})

server.get('/health', async () => {
  return {
    status: 'ok',
    service: 'monitorae-backend',
    timestamp: new Date().toISOString(),
  }
})

server.register(endpointRoutes, { prefix: '/api/endpoints' })

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Server is running on http://localhost:3001')

    await scheduleHealthChecks()
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

const listeners = ['SIGINT', 'SIGTERM']
listeners.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`)
    await server.close()
    process.exit(0)
  })
})

start()
