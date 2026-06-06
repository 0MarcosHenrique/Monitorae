# Monitorae - Real-time API Monitor

Monitorae is a full-stack monitoring project for tracking API health, latency, status changes, alerts and incidents.

The goal is to provide a practical dashboard where users can register endpoints, run scheduled health checks and inspect the latest availability history.

## Features

- Register API endpoints with method, timeout, interval and expected status codes.
- Run scheduled checks with Redis and BullMQ.
- Store health check history in PostgreSQL with Prisma.
- Detect status changes and create alerts/incidents.
- Provide a Next.js dashboard for endpoint status overview.
- Docker Compose setup for local development.

## Tech Stack

### Frontend

- Next.js 14
- React
- TypeScript
- Tailwind CSS

### Backend

- Node.js 20
- Fastify
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- TypeScript

## Getting Started

### Requirements

- Docker and Docker Compose
- Node.js 20, if running services outside Docker

### Run With Docker

```bash
docker compose up -d
```

The backend container runs Prisma generate and applies pending migrations before starting the API.

Then open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Backend health: http://localhost:3001/health

### Useful Backend Commands

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### Useful Frontend Commands

```bash
cd frontend
npm install
npm run dev
```

## API Routes

Base URL: `http://localhost:3001/api/endpoints`

- `GET /` - list active endpoints
- `GET /:id` - get one endpoint with recent checks
- `POST /` - create an endpoint and schedule checks. If `userId` is omitted, the API uses a demo user.
- `PUT /:id` - update an endpoint and reschedule checks
- `DELETE /:id` - soft-delete an endpoint and remove its scheduled job

Health check:

- `GET /health` - check whether the backend process is running

## Dashboard Flow

Open `http://localhost:3000`, add an endpoint from the form and wait for scheduled checks to update the status table.

The dashboard currently shows:

- total monitored endpoints;
- current UP/DOWN/PENDING count;
- average latency from the latest checks;
- endpoint list with status, last status code, latency, interval and last check time.

## Project Status

This is an MVP intended for portfolio development. The backend monitoring flow is the strongest part today; the dashboard is intentionally minimal and can evolve with charts, auth, alert channels and real-time updates.
