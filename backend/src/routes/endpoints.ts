import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { processEndpointHealthCheck } from '../services/healthCheckRunner'
import { addEndpointJob, removeEndpointJob } from '../workers/scheduler'
import {
  createEndpointSchema,
  endpointIdParamsSchema,
  queryParamsSchema,
  updateEndpointSchema,
} from '../validators/endpoint'

const sendSuccess = (reply: FastifyReply, data: unknown, statusCode = 200) => {
  return reply.status(statusCode).send({
    success: true,
    data,
    error: null,
  })
}

const sendError = (reply: FastifyReply, error: unknown, statusCode: number) => {
  return reply.status(statusCode).send({
    success: false,
    data: null,
    error,
  })
}

const getDemoUserId = async () => {
  const user = await prisma.user.upsert({
    where: {
      email: 'demo@monitorae.com',
    },
    update: {},
    create: {
      email: 'demo@monitorae.com',
      name: 'Demo User',
      slug: 'demo',
    },
  })

  return user.id
}

export const endpointRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/', async (request, reply) => {
    try {
      const result = queryParamsSchema.safeParse(request.query)

      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      const { userId } = result.data

      const endpoints = await prisma.endpoint.findMany({
        where: {
          userId: userId || undefined,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          healthChecks: {
            orderBy: {
              checkedAt: 'desc',
            },
            take: 1,
          },
        },
      })

      return sendSuccess(reply, endpoints)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.get('/:id', async (request, reply) => {
    try {
      const result = endpointIdParamsSchema.safeParse(request.params)

      if (!result.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const { id } = result.data

      const endpoint = await prisma.endpoint.findUnique({
        where: { id },
        include: {
          healthChecks: {
            orderBy: {
              checkedAt: 'desc',
            },
            take: 30,
          },
          alerts: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 20,
          },
          incidents: {
            orderBy: {
              startedAt: 'desc',
            },
            take: 10,
          },
        },
      })

      if (!endpoint || !endpoint.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      return sendSuccess(reply, endpoint)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.post('/:id/check', async (request, reply) => {
    try {
      const result = endpointIdParamsSchema.safeParse(request.params)

      if (!result.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const endpoint = await prisma.endpoint.findUnique({
        where: { id: result.data.id },
      })

      if (!endpoint || !endpoint.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      const processed = await processEndpointHealthCheck(endpoint)

      if (!processed) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      return sendSuccess(reply, processed, 201)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.post('/', async (request, reply) => {
    try {
      const result = createEndpointSchema.safeParse(request.body)

      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      const userId = result.data.userId || await getDemoUserId()
      const endpoint = await prisma.endpoint.create({
        data: {
          ...result.data,
          userId,
        },
      })

      await addEndpointJob(endpoint)

      return sendSuccess(reply, endpoint, 201)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.put('/:id', async (request, reply) => {
    try {
      const paramsResult = endpointIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const bodyResult = updateEndpointSchema.safeParse(request.body)
      if (!bodyResult.success) {
        return sendError(reply, bodyResult.error.format(), 400)
      }

      const { id } = paramsResult.data

      const existing = await prisma.endpoint.findUnique({
        where: { id },
      })

      if (!existing || !existing.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      const updatedEndpoint = await prisma.endpoint.update({
        where: { id },
        data: bodyResult.data,
      })

      await addEndpointJob(updatedEndpoint)

      return sendSuccess(reply, updatedEndpoint)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.delete('/:id', async (request, reply) => {
    try {
      const result = endpointIdParamsSchema.safeParse(request.params)

      if (!result.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const { id } = result.data

      const existing = await prisma.endpoint.findUnique({
        where: { id },
      })

      if (!existing || !existing.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      await prisma.endpoint.update({
        where: { id },
        data: { isActive: false },
      })

      await removeEndpointJob(id)

      return sendSuccess(reply, { id, deleted: true })
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })
}
