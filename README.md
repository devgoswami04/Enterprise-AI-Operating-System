# Enterprise AI Operating System

A production-shaped, multi-agent AI workspace for teams: enterprise knowledge retrieval with citations, orchestrated agent runs, an asynchronous workflow engine with human approval gates, organizational memory, security controls, audit trails, and observability — behind a dark enterprise cockpit UI.

Built with Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL + pgvector, Redis + BullMQ, and Zod-validated service layers.

## Two runtime modes, one codebase

Every data operation routes through a single persistence facade (`src/lib/data/store.ts`):

| | Mock mode (default) | Production mode |
|---|---|---|
| Trigger | no `DATABASE_URL` | `DATABASE_URL` set |
| Storage | in-process memory (`memory-store.ts`) | PostgreSQL via Drizzle (`src/lib/db/repositories/`) |
| Vector search | deterministic hash embeddings, in-process cosine | pgvector nearest-neighbor + configured embedding provider |
| Auth | seeded demo users, plaintext compare | bcrypt hashes verified against Postgres |
| Workflows | executed inline during the SSE stream | optionally queued to Redis/BullMQ and processed by a background worker |
| Survives restart | no | yes |

Mock mode exists so `npm install && npm run dev` works with zero external services. It is honestly labeled as such throughout the code — it is a demo fallback, not the product.

## Quick start (mock mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000 and log in:

- Admin: `admin@novaworks.ai` / `admin123`
- Member: `member@novaworks.ai` / `member123`
- Viewer: `viewer@novaworks.ai` / `viewer123`

## Full stack (Postgres + pgvector + Redis)

```bash
cp .env.example .env.local        # Windows: copy .env.example .env.local
docker compose up -d              # starts pgvector Postgres + Redis
npm run db:migrate                # creates extension + applies ./drizzle migrations
npm run db:seed                   # org, bcrypt users, embedded documents, starter memories
npm run dev
```

Set in `.env.local`:

```
DATABASE_URL=postgres://enterprise_ai:enterprise_ai@localhost:5432/enterprise_ai_os
SESSION_SECRET=<generate a long random string>
```

### Background workflow worker (optional)

By default workflow runs execute inside the SSE request. To run them asynchronously through Redis/BullMQ:

```
REDIS_URL=redis://localhost:6379
QUEUE_PROVIDER=bullmq
ENABLE_BULLMQ=true
```

then in a second terminal:

```bash
npm run worker
```

With the worker on, the SSE stream switches to *watcher* mode (it observes persisted run state instead of driving execution) so runs are never double-executed. Approving a gated tool call re-enqueues the paused run; the worker resumes it from its persisted step.

## Verification

```bash
npm run lint        # 0 problems
npm run typecheck   # clean
npm run test        # 27 tests: security, RBAC, retrieval, orchestration, workflows, tool gating
npm run build       # production build
npm run smoke       # end-to-end against live Postgres (requires DATABASE_URL):
                    # bcrypt auth -> pgvector retrieval -> chat orchestration ->
                    # workflow -> approval gate -> resume -> audit/eval -> tenant isolation
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `start` | production build / serve |
| `npm run lint` / `typecheck` / `test` | quality gates |
| `npm run db:generate` | regenerate SQL migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | create pgvector extension + apply migrations |
| `npm run db:seed` | idempotent demo seed |
| `npm run worker` | BullMQ workflow worker (needs `REDIS_URL` + `DATABASE_URL`) |
| `npm run smoke` | live end-to-end verification against Postgres |

## Provider posture

Generation (`AI_PROVIDER`): `mock` (default, deterministic), `openai`, `anthropic`, `gateway`, `ollama`.
Embeddings (`EMBEDDING_PROVIDER`): `mock` (default), `openai`, `huggingface` (local Transformers.js).
Tools (`TOOL_PROVIDER` + `ENABLE_LIVE_TOOLS`): mock-safe by default; live GitHub/Slack adapters activate only with scoped credentials.

Documents ingested in production mode are chunked and embedded with the **configured** embedding provider, stored in pgvector, and retrieved by database-side nearest-neighbor search with hybrid semantic+lexical re-ranking.

## Runtime contracts

- Health: `GET /api/health` · Metrics (Prometheus format): `GET /api/metrics` · OpenAPI: `GET /api/openapi`
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API: [docs/API.md](docs/API.md) · Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## What is real vs. mock — honest inventory

**Real in both modes:** typed agent state machine with retries/timeouts/failure recording; prompt-injection detection and PII masking; RBAC with signed HTTP-only JWT sessions; approval-gated tool lifecycle (`pending_approval → executed/cancelled`) on a persisted ledger; workflow engine executing real per-step work (retrieval, memory writes, tool-call creation); structured logging; evaluation records (groundedness, citation coverage, retrieval quality).

**Real only in production mode:** durable Postgres persistence for every entity; pgvector similarity search; bcrypt credential verification; BullMQ background processing; provider-generated embeddings.

**Mock by default (real path exists behind flags):** LLM text generation; live tool execution (GitHub/Slack adapters make real API calls only with `ENABLE_LIVE_TOOLS=true` + credentials).

**Not implemented (extension points, not fake features):** OCR ingestion; Qdrant retrieval adapter; SSO/OIDC.
