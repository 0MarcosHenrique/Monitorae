import { z } from 'zod'

// Schema para query params (ex: ?userId=123)
export const queryParamsSchema = z.object({
  userId: z.string().uuid().optional(),
})

// Schema de criação (obrigatório ter nome, userId, url, etc)
export const createEndpointSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(3).max(100),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.record(z.any()).optional(),
  expectedStatus: z.array(z.number()).default([200]),
  interval: z.number().min(10).default(60),
  timeout: z.number().default(10000),
  expectedBodyContains: z.string().optional(),
})

// Schema de atualização (tudo é opcional, herdado do esquema de criação)
export const updateEndpointSchema = createEndpointSchema.partial()

// Schema para capturar ID da rota (ex: /api/endpoints/:id)
export const endpointIdParamsSchema = z.object({
  id: z.string().uuid(),
})
