# Enterprise AI Operating System MVP

A production-shaped multi-agent AI workspace for teams. It includes a protected enterprise cockpit, seeded demo RBAC users, RAG-style knowledge search, streaming agent traces, workflow automation, human-gated tool execution, organizational memory, security controls, audit logs, evaluation metrics, and observability panels.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo credentials:

- Admin: `admin@novaworks.ai` / `admin123`
- Member: `member@novaworks.ai` / `member123`
- Viewer: `viewer@novaworks.ai` / `viewer123`

## Optional Postgres Runtime

The app runs in safe mock mode without external secrets. To start pgvector Postgres for schema work:

```bash
copy .env.example .env.local
docker compose up -d
npm run db:seed
```

## Scripts

- `npm run dev` - local development server
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript validation
- `npm run test` - Vitest unit/integration tests
- `npm run build` - production build
- `npm run db:push` - apply Drizzle schema to Postgres
- `npm run db:seed` - seed demo database rows

## Runtime Contracts

- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- OpenAPI: [http://localhost:3000/api/openapi](http://localhost:3000/api/openapi)
- Memory API: `GET /api/memory`
- Security API: `GET /api/security/events`
- Architecture notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Deployment notes: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Provider Posture

Live providers are intentionally disabled by default. The code exposes adapters for `AI_PROVIDER`, `EMBEDDING_PROVIDER`, provider credentials, local Ollama, `GITHUB_TOKEN`, and future tool connectors while keeping all local workflows safe and deterministic.

Generation modes:

- `AI_PROVIDER=mock` - deterministic local orchestration and grounded answer fallback.
- `AI_PROVIDER=gateway` - Vercel AI Gateway through the AI SDK model string path.
- `AI_PROVIDER=openai` - direct OpenAI generation, requires `OPENAI_API_KEY`.
- `AI_PROVIDER=anthropic` - direct Anthropic Messages API generation, requires `ANTHROPIC_API_KEY`.
- `AI_PROVIDER=ollama` - local Ollama generation using `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.

Embedding modes:

- `EMBEDDING_PROVIDER=mock` - deterministic local hash embeddings.
- `EMBEDDING_PROVIDER=openai` - direct OpenAI embeddings via `text-embedding-3-small`.
- `EMBEDDING_PROVIDER=huggingface` - local Transformers.js feature extraction with `HUGGINGFACE_EMBEDDING_MODEL`.
