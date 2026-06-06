import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../lib/prisma'
import { createAuthToken, hashPassword, verifyAuthToken, verifyPassword } from '../services/auth'
import { loginSchema, registerSchema } from '../validators/auth'

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

const getBearerToken = (request: FastifyRequest) => {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

const createSlug = (email: string) => {
  const base = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${base || 'user'}-${Date.now()}`
}

export const authRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/register', async (request, reply) => {
    try {
      const result = registerSchema.safeParse(request.body)

      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email: result.data.email,
        },
      })

      if (existingUser) {
        return sendError(reply, 'Email already registered', 409)
      }

      const user = await prisma.user.create({
        data: {
          email: result.data.email,
          name: result.data.name,
          slug: createSlug(result.data.email),
          passwordHash: hashPassword(result.data.password),
        },
        select: {
          id: true,
          email: true,
          name: true,
          slug: true,
        },
      })

      return sendSuccess(reply, {
        user,
        token: createAuthToken(user.id),
      }, 201)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.post('/login', async (request, reply) => {
    try {
      const result = loginSchema.safeParse(request.body)

      if (!result.success) {
        return sendError(reply, result.error.format(), 400)
      }

      const user = await prisma.user.findUnique({
        where: {
          email: result.data.email,
        },
      })

      if (!user?.passwordHash || !verifyPassword(result.data.password, user.passwordHash)) {
        return sendError(reply, 'Invalid email or password', 401)
      }

      return sendSuccess(reply, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          slug: user.slug,
        },
        token: createAuthToken(user.id),
      })
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })

  fastify.get('/me', async (request, reply) => {
    try {
      const token = getBearerToken(request)
      const payload = token ? verifyAuthToken(token) : null

      if (!payload) {
        return sendError(reply, 'Unauthorized', 401)
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          slug: true,
        },
      })

      if (!user) {
        return sendError(reply, 'Unauthorized', 401)
      }

      return sendSuccess(reply, user)
    } catch (err) {
      fastify.log.error(err)
      return sendError(reply, 'Internal Server Error', 500)
    }
  })
}
