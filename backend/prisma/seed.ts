import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando o seeding do banco de dados...')

  // Limpa o banco de dados (opcional, evita erros de chave duplicada ao rodar várias vezes)
  await prisma.healthCheck.deleteMany()
  await prisma.incident.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.alertRule.deleteMany()
  await prisma.endpoint.deleteMany()
  await prisma.user.deleteMany()

  // 1. Criar um usuário demo
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@monitorae.com',
      name: 'Demo User',
      slug: 'demo',
    },
  })
  console.log(`👤 Usuário criado com ID: ${demoUser.id}`)

  // 2. Criar Endpoints
  const endpointsData = [
    {
      userId: demoUser.id,
      name: 'Google',
      url: 'https://google.com',
      method: 'GET',
      expectedStatus: [200, 301, 302],
      interval: 60,
      currentStatus: 'UP',
      lastCheckedAt: new Date(),
    },
    {
      userId: demoUser.id,
      name: 'GitHub API',
      url: 'https://api.github.com',
      method: 'GET',
      expectedStatus: [200],
      interval: 300,
      currentStatus: 'UP',
      lastCheckedAt: new Date(),
    },
    {
      userId: demoUser.id,
      name: 'JSONPlaceholder',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
      expectedStatus: [200],
      expectedBodyContains: 'userId',
      interval: 120,
      currentStatus: 'UP',
      lastCheckedAt: new Date(),
    },
  ]

  const createdEndpoints = []
  for (const ep of endpointsData) {
    const created = await prisma.endpoint.create({ data: ep })
    createdEndpoints.push(created)
    console.log(`🌐 Endpoint criado: ${created.name}`)
  }

  // 3. Criar Health Checks (Dados históricos)
  const now = new Date()
  
  for (const endpoint of createdEndpoints) {
    const checks = []
    
    // Criar 15 verificações históricas no passado
    for (let i = 0; i < 15; i++) {
      // Tempo do check: recuando no tempo com base no intervalo
      const checkTime = new Date(now.getTime() - (i * endpoint.interval * 1000))
      
      // Simulando uma falha pontual no JSONPlaceholder
      const isFailed = i === 3 && endpoint.name === 'JSONPlaceholder'
      
      let latency = Math.random() * 100 + 50 // 50-150ms
      if (endpoint.name === 'Google') latency -= 30 // Mais rápido
      
      checks.push({
        endpointId: endpoint.id,
        statusCode: isFailed ? 500 : 200,
        latency: isFailed ? 5000 : latency, // Alta latência se falhou
        isUp: !isFailed,
        responseBody: isFailed ? 'Internal Server Error' : (endpoint.name === 'JSONPlaceholder' ? '{"userId": 1, "id": 1, "title": "sunt aut facere..."}' : null),
        errorMessage: isFailed ? 'Connection timeout' : null,
        checkedAt: checkTime,
      })
    }
    
    await prisma.healthCheck.createMany({ data: checks })
    console.log(`✅ Foram criados ${checks.length} health checks para ${endpoint.name}`)
    
    // Criar incidente para a falha simulada
    if (endpoint.name === 'JSONPlaceholder') {
      const failedTime = new Date(now.getTime() - (3 * endpoint.interval * 1000))
      const resolvedTime = new Date(now.getTime() - (2 * endpoint.interval * 1000))
      
      await prisma.incident.create({
        data: {
          endpointId: endpoint.id,
          startedAt: failedTime,
          resolvedAt: resolvedTime,
          errorCode: 500,
          errorMessage: 'Connection timeout',
          duration: (resolvedTime.getTime() - failedTime.getTime()) / 1000 // duração em segundos
        }
      })
      console.log(`⚠️ Criado 1 incidente histórico para ${endpoint.name}`)
    }
    
    // Criar uma Regra de Alerta de exemplo
    await prisma.alertRule.create({
      data: {
        endpointId: endpoint.id,
        name: 'Alerta de Downtime',
        condition: 'status != 200',
        threshold: 3,
        cooldown: 15,
        channels: ['EMAIL', 'DISCORD'],
      }
    })
  }

  console.log('🎉 Seeding concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
