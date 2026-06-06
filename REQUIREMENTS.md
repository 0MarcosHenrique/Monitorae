# Requirements

## Required For Docker

- Docker Desktop
- Docker Compose

This is the recommended way to run the project locally because it starts PostgreSQL, Redis, backend and frontend together.

## Required For Local Development

- Node.js 20 or newer
- npm
- PostgreSQL 16
- Redis 7

## Default Local Ports

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Backend health check: `http://localhost:3001/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Environment Variables

Backend:

```env
DATABASE_URL=postgresql://admin:admin123@localhost:5432/monitorae
REDIS_URL=redis://localhost:6379
PORT=3001
AUTH_TOKEN_SECRET=change-me-in-production
AUTH_TOKEN_TTL_SECONDS=604800
ALERT_CHANNELS=DISCORD,TELEGRAM,EMAIL
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
```

Frontend:

```env
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
PORT=3000
```

Inside Docker, the frontend server uses `BACKEND_URL=http://backend:3001` so server-side rendering can reach the backend container.

## Recommended Verification

```bash
docker compose up -d --build
```

```bash
curl http://localhost:3001/health
```

```bash
cd backend
npm run build
npm test
npm audit --omit=dev
```

```bash
cd frontend
npm run typecheck
npm run build
npm audit --omit=dev
```
