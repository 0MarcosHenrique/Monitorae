# Monitoraê - Infraestrutura Real-time Monitor

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Deploy Status](https://img.shields.io/badge/deploy-success-success)

Bem-vindo ao **Monitoraê**, um sistema completo e em tempo real para monitoramento de APIs.

## 🚀 Como começar

### Pré-requisitos
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (versão 20 recomendada)

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/0MarcosHenrique/Monitorae.git
cd Monitorae
```

2. Inicie os containers com Docker Compose:
```bash
docker compose up -d
```

3. Acesse a aplicação no seu navegador:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend (API): [http://localhost:3001](http://localhost:3001)

## 🛠️ Tech Stack

### Frontend
- ⚛️ **Next.js 14** & **React**
- 🎨 **Tailwind CSS**
- 📊 **Tremor** & **Recharts** (Dashboards)
- 🔌 **Socket.io-client** (Real-time)
- 🟦 **TypeScript**

### Backend
- ⚡ **Node.js 20** & **Fastify**
- 🗄️ **PostgreSQL** & **Prisma ORM**
- 🔴 **Redis** & **BullMQ** (Filas e Background Jobs)
- 🔄 **WebSockets** (@fastify/websocket)
- 🟦 **TypeScript**
