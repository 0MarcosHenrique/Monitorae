import { z } from 'zod'

export const queryParamsSchema = z.object({
  userId: z.string().uuid().optional(),
})

export const createEndpointSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(3).max(100),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.record(z.any()).optional(),
  expectedStatus: z.array(z.number().int().min(100).max(599)).min(1).default([200]),
  interval: z.number().int().min(10).default(60),
  timeout: z.number().int().min(1000).default(10000),
  expectedBodyContains: z.string().optional(),
})

export const updateEndpointSchema = createEndpointSchema.partial()

export const endpointIdParamsSchema = z.object({
  id: z.string().uuid(),
})
