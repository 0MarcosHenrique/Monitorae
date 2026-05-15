import { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { 
  createEndpointSchema, 
  updateEndpointSchema, 
  queryParamsSchema,
  endpointIdParamsSchema
} from '../validators/endpoint'

// Utilitário para formatar respostas de sucesso (Evita repetição)
const sendSuccess = (reply: FastifyReply, data: any, statusCode: number = 200) => {
  return reply.status(statusCode).send({
    success: true,
    data,
    error: null,
  })
}

// Utilitário para formatar respostas de erro (Evita repetição)
const sendError = (reply: FastifyReply, error: any, statusCode: number) => {
  return reply.status(statusCode).send({
    success: false,
    data: null,
    error,
  })
}

export const endpointRoutes = async (fastify: FastifyInstance) => {
  
  // GET /api/endpoints
  fastify.get('/', async (request, reply) => {
    try {
      const result = queryParamsSchema.safeParse(request.query)
      
      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      const { userId } = result.data

      // Busca todos os endpoints (apenas os ativos) vinculados ao usuário
      const endpoints = await prisma.endpoint.findMany({
        where: {
          userId: userId ? userId : undefined,
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
            take: 1, // Traz apenas o healthcheck mais recente
          },
        },
      })

      return sendSuccess(reply, endpoints, 200)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  // GET /api/endpoints/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const result = endpointIdParamsSchema.safeParse(request.params)

      if (!result.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const { id } = result.data

      // Busca um endpoint em específico com seus últimos 10 health checks
      const endpoint = await prisma.endpoint.findUnique({
        where: { id },
        include: {
          healthChecks: {
            orderBy: {
              checkedAt: 'desc',
            },
            take: 10,
          },
        },
      })

      // Retorna 404 caso não exista ou caso esteja inativo (soft deleted)
      if (!endpoint || !endpoint.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      return sendSuccess(reply, endpoint, 200)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  // POST /api/endpoints
  fastify.post('/', async (request, reply) => {
    try {
      const result = createEndpointSchema.safeParse(request.body)

      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      // Cria efetivamente o endpoint
      const endpoint = await prisma.endpoint.create({
        data: result.data,
      })

      return sendSuccess(reply, endpoint, 201)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  // PUT /api/endpoints/:id
  fastify.put('/:id', async (request, reply) => {
    try {
      // Valida o parâmetro ID da URL
      const paramsResult = endpointIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }
      
      // Valida o payload de envio utilizando o schema com Partial
      const bodyResult = updateEndpointSchema.safeParse(request.body)
      if (!bodyResult.success) {
        return sendError(reply, bodyResult.error.format(), 400)
      }

      const { id } = paramsResult.data

      // Validamos se o recurso que o usuário quer alterar de fato existe e está ativo
      const existing = await prisma.endpoint.findUnique({
        where: { id }
      })

      if (!existing || !existing.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      const updatedEndpoint = await prisma.endpoint.update({
        where: { id },
        data: bodyResult.data,
      })

      return sendSuccess(reply, updatedEndpoint, 200)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  // DELETE /api/endpoints/:id
  fastify.delete('/:id', async (request, reply) => {
    try {
      const result = endpointIdParamsSchema.safeParse(request.params)

      if (!result.success) {
        return sendError(reply, 'Invalid ID format', 400)
      }

      const { id } = result.data

      // Conferimos se já não foi deletado
      const existing = await prisma.endpoint.findUnique({
        where: { id }
      })

      if (!existing || !existing.isActive) {
        return sendError(reply, 'Endpoint not found', 404)
      }

      // Soft delete: apenas desativa flag isActive em vez de apagar a row e perder histórico
      await prisma.endpoint.update({
        where: { id },
        data: { isActive: false },
      })

      return sendSuccess(reply, { id, deleted: true }, 200)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })
}
