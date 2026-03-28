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

# Run tests (backend)
npm test --workspace=backend

# Run tests (frontend)
npm test --workspace=frontend
```

## Architecture

This is an npm monorepo with three workspaces: `backend`, `frontend`, `electron`. The `shared` workspace (`@sql-assistant/shared`) exports all shared TypeScript types from `shared/types.ts` and is aliased in `backend/tsconfig.json`.

### Two-database pattern

The backend uses **two separate databases** with distinct roles:

- **SQLite** (`better-sqlite3`) — the app's own config store. Holds `connections` (saved MSSQL credentials), `settings` (AI provider config, language, cache TTL), and `query_history`. Initialized at startup from `backend/db/sqlite.ts`; migrations in `backend/db/migrations/`.
- **MSSQL** (`mssql`) — the user's target SQL Server. Queried at runtime via `backend/services/sqlserver.ts`. A new connection pool is opened and closed per query.

### Query pipeline

`POST /api/query` is the core endpoint. The full flow in `backend/routes/query.ts`:
1. Load connection row from SQLite → decrypt password
2. Fetch schema from the MSSQL target (via `services/schema.ts`, cached in-memory with configurable TTL)
3. Call `generateSQL()` from `services/aiProvider.ts`
   - Reads AI provider settings from SQLite `settings` table
   - Builds schema-aware system prompt via `services/promptBuilder.ts`
   - Delegates to `ClaudeProvider` or `OllamaProvider` based on `ai_provider` setting
   - LLM must return raw JSON (no markdown fences) matching `AIResponse`; falls back to text mode if unparseable
4. Execute the returned SQL on MSSQL — blocked by `FORBIDDEN` regex before execution
5. Log to `query_history` and return `QueryResult`

### AI provider selection

Runtime selection between Claude (external) and Ollama (local) is controlled by the `ai_provider` key in the SQLite `settings` table. Both providers implement the `AIProvider` interface in `services/aiProvider.ts`. Provider config is always read fresh from SQLite (no in-memory caching).

### Authentication

TOTP-based auth (`otplib`). Flow: first run → `POST /api/auth/setup` generates a secret + QR code → user scans into authenticator app → `POST /api/auth/verify` validates and issues a session token (UUID, 8-hour TTL, in-memory). All routes except `/api/health` and `/api/auth/*` require a `Bearer` token. Rate limiting: 5 failed attempts triggers a 5-minute lockout. `backend/scripts/generate-totp.ts` is a CLI utility for manual TOTP setup.

Session tokens are held in memory — a backend restart requires re-login. This is acceptable for a single-user desktop app.

### Security

- **Read-only enforcement**: `backend/services/sqlserver.ts` blocks INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, and EXEC before any query reaches SQL Server.
- **Password encryption**: `backend/utils/crypto.ts` uses AES-256-GCM (version byte + IV + auth tag). Requires `ENCRYPTION_KEY` in `.env`.
- **Schema metadata only**: only table/column names are sent to the AI — never row data.

### Frontend

Next.js 15 / React 19 SPA. Pages:
- `/` — root redirect (checks auth status, routes to `/setup`, `/login`, or `/chat`)
- `/setup` — first-run TOTP setup (QR code display + confirmation)
- `/login` — TOTP login with lockout countdown
- `/chat` — main interface (question input, SQL strip, result panel, history sidebar)
- `/settings/connections` — CRUD for saved MSSQL connections
- `/settings/ai-provider` — toggle Claude/Ollama, model selection, connectivity test
- `/settings/preferences` — language preference (EN/ES)

Key components: `ConnPanel`, `ResultPanel` (table/text/mixed/performance modes, CSV export), `SqlStrip` (collapsible, Shiki syntax highlighting, copy), `AIProviderBadge`, `SessionGuard` (30-min idle timeout).

`frontend/lib/api.ts` is the authenticated fetch wrapper. `frontend/lib/language-context.tsx` provides bilingual (EN/ES) React context with `localStorage` persistence.

### Electron

`electron/main.js` launches the backend as a child process, waits for `/api/health` to respond (30 retries, 500ms each), then opens a `BrowserWindow` pointing at the Next.js dev server (dev) or static export (prod). Backend process is killed on app exit.

### Environment

Copy `.env.example` to `.env`. Key variables:
- `ANTHROPIC_API_KEY` — required when using Claude
- `SQLITE_PATH` — defaults to `./data/config.db`
- `BACKEND_PORT` — defaults to `3001`
- `FRONTEND_PORT` — defaults to `3000`
