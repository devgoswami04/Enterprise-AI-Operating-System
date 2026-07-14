# API

Live OpenAPI JSON: `/api/openapi`. All endpoints except health/openapi require the session cookie; mutating endpoints are rate-limited and Zod-validated.

- `GET /api/health` — readiness and provider posture
- `GET /api/metrics` — Prometheus-format operational metrics
- `POST /api/chat` — SSE stream of the orchestrated, cited answer
- `GET/POST /api/documents` — list / upload+index (PDF, TXT, MD, CSV, JSON)
- `GET /api/search?q=` — semantic retrieval with citations and security assessment
- `GET/POST /api/memory` — list; `?mode=recall` for semantic recall, default write
- `GET /api/security/events` — admin-only security events, audit log, tool ledger
- `POST /api/workflows/:id/runs` — start a workflow run (returns run id)
- `GET /api/runs/:id/events` — SSE stream of run progress (driver in mock mode, watcher when BullMQ is on)
- `POST /api/tools/:tool/execute` — approve/reject a pending tool call; approval resumes a paused workflow
