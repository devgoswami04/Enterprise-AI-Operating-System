# Architecture

Enterprise AI OS is a Next.js App Router application with a service-oriented backend, a dual-mode persistence layer, and an asynchronous workflow engine.

## Layer map

```
Frontend cockpit (app router pages, SSE clients)
        │
API gateway (/api/* route handlers: session, RBAC, rate limits, Zod validation)
        │
Services (src/modules/*: documents, retrieval, memory, tools, workflows, security, observability)
        │
Persistence facade (src/lib/data/store.ts — async, mode-routing)
   ├── memory-store.ts       (no DATABASE_URL: in-process, zero-setup demo mode)
   └── db/repositories/*     (DATABASE_URL: Drizzle + PostgreSQL + pgvector)
```

Rules enforced by the structure:

- Routes and services import **only** the facade, never a repository or the memory store directly. Mode is a deployment decision, not a code path decision.
- Business logic lives in `src/modules/*` services, not React components.
- Workflow/agent *definitions* are versioned code (`src/lib/data/definitions.ts`), like Airflow DAGs; *runs* are tenant-scoped data. Runs reference definitions by stable slug.

## Agent orchestration

`src/modules/agents/state-machine.ts` executes a typed node graph with per-node retry policies, timeouts, attempt tracking, and failure short-circuiting. `src/lib/ai/orchestrator.ts` composes the chat graph: Security → Planner → Model Router → Research (real retrieval) → Memory (semantic recall) → Analyst → Evaluator → Writer. Every run persists its steps, statuses, timestamps, latencies, token counts, and provider; the UI trace renders persisted state, not scripted animation.

## Retrieval (RAG)

Ingestion validates the upload (PDF/TXT/MD/CSV/JSON), extracts and normalizes text, chunks at sentence boundaries with overlap, embeds each chunk with the configured `EMBEDDING_PROVIDER`, and stores document + chunk rows. In production mode retrieval embeds the query, pulls a candidate set via pgvector cosine distance (`<=>`) **in the database**, then re-ranks hybrid (semantic 0.65 / lexical 0.35). Citations map answers back to chunk and document IDs. OCR is an extension point, not a claimed feature.

## Workflow engine

`src/lib/workflows/engine.ts` defines `executeWorkflowStep` — the single implementation of what a step does: research steps retrieve evidence, writer steps persist episodic memory, approval-gated tool steps create a `pending_approval` tool call and pause the run (`waiting_approval`, `currentStep` saved). Two schedulers drive the same function:

1. **SSE executor** — streams transitions live (mock/default mode).
2. **BullMQ worker** (`src/worker.ts`) — consumes the Redis queue with retries/backoff (production mode). When active, SSE becomes a read-only watcher of persisted state, so a run is never driven twice.

Approving a tool call re-enqueues (or inline-resumes) the paused run from its persisted step. Runs, events, and approvals are durable and auditable.

## Memory

Short-term: conversation messages. Long-term: org-scoped memory records with importance scoring, decay dates, and reasons. Semantic recall embeds the query and blends cosine similarity (0.75) with importance (0.25). Chat and workflow outcomes write durable memories through one abstraction (`writeDurableMemory`).

## Security

Signed HTTP-only JWT sessions; bcrypt verification in production mode. Role hierarchy (admin > member > viewer) enforced in routes. Deterministic prompt-injection patterns and PII masking run on chat, search, tool, and upload inputs; findings become persisted security events. High-risk tool payloads require explicit approval or throw `SecurityError`. Every entity is organization-scoped; repository queries filter by `organizationId` unconditionally.

## Observability

Structured JSON logs (timestamp, org, user, requestId, component, severity) across agents, workflows, tools, memory, retrieval. Prometheus-format metrics at `/api/metrics`; health at `/api/health`. Evaluation records score groundedness, citation coverage, retrieval quality, and hallucination risk per chat run.

## Verification artifacts

- `npm run test` — 27 unit/integration tests (mock mode, no services needed).
- `npm run smoke` — live Postgres end-to-end: auth → retrieval → orchestration → workflow → approval → resume → tenant isolation.
