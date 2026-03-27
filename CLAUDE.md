# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend only (most common during development)
npm run dev:backend

# Run all workspaces together
npm run dev

# Run DB migrations (must be run before first start)
npm run db:migrate

# Type-check all workspaces
npm run lint

# Type-check backend only
npm run lint --workspace=backend
```

## Architecture

This is an npm monorepo with three workspaces: `backend`, `frontend` (empty), `electron` (empty). The `shared` workspace (`@sql-assistant/shared`) exports all shared TypeScript types from `shared/types.ts` and is aliased in `backend/tsconfig.json`.

### Two-database pattern

The backend uses **two separate databases** with distinct roles:

- **SQLite** (`better-sqlite3`) — the app's own config store. Holds `connections` (saved MSSQL credentials), `settings` (AI provider config, language, cache TTL), and `query_history`. Initialized at startup from `backend/db/sqlite.ts`; migrations in `backend/db/migrations/`.
- **MSSQL** (`mssql`) — the user's target SQL Server. Queried at runtime via `backend/services/sqlserver.ts`. A new connection pool is opened and closed per query.

### Query pipeline

`POST /api/query` is the core endpoint. The full flow in `backend/routes/query.ts`:
1. Load connection row from SQLite → decrypt password
2. Fetch schema from the MSSQL target (via `services/schema.ts` — not yet implemented)
3. Call `generateSQL()` from `services/aiProvider.ts`
   - Reads AI provider settings from SQLite `settings` table
   - Builds schema-aware system prompt via `services/promptBuilder.ts`
   - Delegates to `ClaudeProvider` or `OllamaProvider` based on `ai_provider` setting
   - LLM must return raw JSON (no markdown fences) matching `AIResponse`
4. Execute the returned SQL on MSSQL — blocked by `FORBIDDEN` regex before execution
5. Log to `query_history` and return `QueryResult`

### AI provider selection

Runtime selection between Claude (external) and Ollama (local) is controlled by the `ai_provider` key in the SQLite `settings` table. Both providers implement the `AIProvider` interface in `services/aiProvider.ts`. Provider config is always read fresh from SQLite (no in-memory caching).

### What's not yet implemented

- `backend/routes/auth.ts` — TOTP authentication (dependency: `otplib`)
- `backend/routes/connections.ts` — CRUD for saved MSSQL connections
- `backend/routes/schema.ts` — schema discovery/caching from target MSSQL
- `backend/utils/crypto.ts` — password encryption/decryption (used by `query.ts`)
- `frontend/` and `electron/` — entirely empty

### Environment

Copy `.env.example` to `.env`. Key variables:
- `AI_PROVIDER` — `external` (Claude) or `local` (Ollama); overridden at runtime by the SQLite `settings` table
- `ANTHROPIC_API_KEY` — required when using Claude
- `SQLITE_PATH` — defaults to `./data/config.db`
- `TOTP_SECRET` — for future auth implementation
