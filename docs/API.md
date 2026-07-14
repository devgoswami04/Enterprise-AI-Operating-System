# API

The live OpenAPI JSON is available at `/api/openapi`.

## Main Endpoints

- `GET /api/health` - runtime readiness and provider posture.
- `POST /api/chat` - streams cited multi-agent answers over Server-Sent Events.
- `GET /api/documents` - lists indexed documents.
- `POST /api/documents` - uploads and indexes PDF/text/markdown/CSV/JSON files.
- `GET /api/search?q=...` - semantic workspace search.
- `GET /api/memory` - lists long-term memories and recent conversation context.
- `GET /api/security/events` - admin-only security, audit, and tool execution ledger.
- `POST /api/workflows/:id/runs` - starts a workflow run.
- `GET /api/runs/:id/events` - streams workflow progress over Server-Sent Events.
- `POST /api/tools/:tool/execute` - approves and executes a safe mock tool action.

All endpoints except health and OpenAPI require the demo session cookie. Mutating and high-volume endpoints include in-memory rate limits for the local MVP.
