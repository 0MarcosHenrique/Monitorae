# Monitorae - Real-time API Monitor

Monitorae is a full-stack monitoring project for tracking API health, latency, status changes, alerts and incidents.

The goal is to provide a practical dashboard where users can register endpoints, run scheduled health checks and inspect the latest availability history.

## Features

- Register API endpoints with method, timeout, interval and expected status codes.
- Run scheduled checks with Redis and BullMQ.
- Store health check history in PostgreSQL with Prisma.
- Detect status changes and create alerts/incidents.
- Provide a Next.js dashboard for endpoint status overview.
- Run manual checks from the dashboard.
- Edit endpoint configuration from the dashboard.
- Inspect endpoint details with latency history, alerts and incidents.
- Send configurable alerts through Discord, Telegram or SMTP email.
- Register/login users with bearer-token authentication.
- Use the dashboard account panel to login/register and send authenticated requests.
- Docker Compose setup for local development.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- CSS

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

See [REQUIREMENTS.md](./REQUIREMENTS.md) for local ports, environment variables and verification commands.

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
npm run typecheck
npm run dev
```

## API Routes

Auth base URL: `http://localhost:3001/api/auth`

- `POST /register` - create a user and return an auth token
- `POST /login` - authenticate and return an auth token
- `GET /me` - return the current user from `Authorization: Bearer <token>`

Base URL: `http://localhost:3001/api/endpoints`

- `GET /` - list active endpoints
- `GET /:id` - get one endpoint with recent checks
- `POST /` - create an endpoint and schedule checks. If `userId` is omitted, the API uses a demo user.
- `POST /:id/check` - run an immediate health check
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
- endpoint list with status, last status code, latency, interval and last check time;
- endpoint editing for URL, method, interval, timeout, expected status and expected response text;
- endpoint removal from the dashboard;
- manual check execution;
- endpoint detail pages with latency history, recent checks, alerts and incidents.
- account panel for login/register using the auth API.

## Project Status

This is an MVP intended for portfolio development. It already includes the core monitoring flow, auth, manual checks, endpoint details, configurable alerts and endpoint editing. Good next steps are UI polish, richer charts and real-time updates.
