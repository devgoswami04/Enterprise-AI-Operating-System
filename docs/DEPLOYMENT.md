# Deployment

## Local

```bash
npm install
npm run dev
```

## Local Postgres + pgvector

```bash
copy .env.example .env.local
docker compose up -d
npm run db:seed
```

## Vercel

1. Create or link a Vercel project.
2. Configure environment variables from `.env.example`.
3. Deploy with Git integration or:

```bash
vercel pull --yes
vercel build
vercel deploy --prebuilt
```

For production, set `SESSION_SECRET`, `DATABASE_URL`, and any live provider tokens. Keep `AI_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` until live provider spend and data handling are approved.
