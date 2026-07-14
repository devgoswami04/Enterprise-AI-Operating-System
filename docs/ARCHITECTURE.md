# Architecture

Enterprise AI OS is a Next.js App Router workspace with a provider-ready backend.

## Runtime Layers

- Frontend cockpit: protected workspace routes for chat, knowledge, agents, workflows, memory, security, observability, and settings.
- API gateway: route handlers under `/api/*` with session checks, RBAC, rate limiting, input assessment, SSE streaming, and safe tool execution.
- Agent layer: state-machine orchestration with planner, model router, research, analyst, writer, security, evaluation, retries, step telemetry, and mock-safe fallback.
- Retrieval layer: chunking, embeddings, lexical/vector ranking, citations, retrieval evaluation, and pgvector-ready schema.
- Memory and audit: in-memory runtime by default, Drizzle/Postgres schema and seed script for persistence work.
- Integrations: provider interfaces for AI, embeddings, storage, and tools.

## Provider Modes

- `AI_PROVIDER=mock` keeps all generation deterministic and local.
- `AI_PROVIDER=gateway` calls Vercel AI Gateway through the AI SDK model-string path.
- `AI_PROVIDER=openai` calls OpenAI through `@ai-sdk/openai` when `OPENAI_API_KEY` is configured.
- `AI_PROVIDER=anthropic` calls the Anthropic Messages API when `ANTHROPIC_API_KEY` is configured.
- `AI_PROVIDER=ollama` calls a local Ollama runtime through `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.
- `EMBEDDING_PROVIDER=mock` uses deterministic hash embeddings.
- `EMBEDDING_PROVIDER=openai` uses `@ai-sdk/openai` with `text-embedding-3-small`.
- `EMBEDDING_PROVIDER=huggingface` uses Transformers.js feature extraction with `HUGGINGFACE_EMBEDDING_MODEL`.

## Safety Model

External actions remain mock-safe by default. High-impact actions such as email, calendar, GitHub, Jira, browser, or Slack execution are represented as tool calls and held behind approval gates.

Prompt inputs pass through deterministic security controls that flag prompt injection patterns, mask sensitive values, truncate oversized input, and write security events. Chat runs also record evaluation metrics for groundedness, citation coverage, retrieval quality, and hallucination risk.
