# Deployment

## Local, zero-setup (mock mode)
```bash
npm install && npm run dev
```

## Local, full stack
```bash
cp .env.example .env.local     # set DATABASE_URL + SESSION_SECRET
docker compose up -d           # pgvector Postgres + Redis
npm run db:migrate && npm run db:seed
npm run dev
# optional async workflows:
#   set REDIS_URL, QUEUE_PROVIDER=bullmq, ENABLE_BULLMQ=true, then:
npm run worker
```

## Production notes
- Set `SESSION_SECRET` (long random), `DATABASE_URL`, and provider keys as platform secrets — never commit them.
- Keep `AI_PROVIDER=mock` / `TOOL_PROVIDER=mock` until live spend and data handling are approved; flip per-provider via env only.
- The web app deploys to any Node/Vercel-compatible target; the worker runs as a separate long-lived process (container/PM2) sharing `DATABASE_URL` and `REDIS_URL`.
- `/api/health` and `/api/metrics` are ready for platform probes and Prometheus scraping.
- Run `npm run smoke` against a staging database as a deployment gate.
