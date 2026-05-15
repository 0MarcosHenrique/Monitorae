import { PrismaClient } from '@prisma/client'

// O TypeScript precisa dessa declaração para estender o globalThis com o prisma
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Utilizando um singleton para prevenir o esgotamento de conexões com o DB em ambiente de desenvolvimento
// (pois ferramentas de hot-reload como o tsx reiniciam o servidor várias vezes).
export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
