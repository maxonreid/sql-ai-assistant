# SQL AI Assistant — SPEC.md

**Version:** 1.4 · March 2026
**Author:** Maxon Torres — MaxonTorres.com

---

## What this document is

This is the single authoritative reference for building SQL AI Assistant. It covers what the product does, what it must look like, every functional and non-functional requirement, the full technology stack, the data model, and the security rules. Read this before writing a single line of code.

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [User](#2-user)
3. [Architecture](#3-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Design System](#5-design-system)
6. [Screens & UI](#6-screens--ui)
7. [Functional Requirements](#7-functional-requirements)
8. [Performance Diagnostics Requirements](#8-performance-diagnostics-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Security Requirements](#10-security-requirements)
11. [Response Types](#11-response-types)
12. [Data Model](#12-data-model)
13. [AI Provider System](#13-ai-provider-system)
14. [Internationalization](#14-internationalization)
15. [Auto-Update](#15-auto-update)
16. [Out of Scope](#16-out-of-scope)
17. [Use Cases](#17-use-cases)

---

## 1. Product Summary

SQL AI Assistant is a **private, single-user Windows desktop application** for a Senior DBA. It connects to one or more SQL Server instances, reads their schema, sends questions to an AI engine (cloud or local), receives T-SQL or DMV queries in return, executes them read-only against SQL Server, and displays results as tables, text, or performance cards.

### Primary purpose
Server performance diagnostics via natural language — CPU, memory, blocking, wait stats, I/O, index fragmentation, active sessions, SQL Agent jobs, tempdb, query store, security risks. The DBA types a question in Spanish or English and gets an answer in seconds without writing SQL.

### Secondary purpose
Business queries — sales, HR, inventory, data quality — on demand.

### Hard rules
- The app **never writes** to any database under any circumstances
- All SQL Server connections are **read-only**, enforced in code
- When External AI is active: only schema metadata (table/column names, types) is sent to the Claude API — never row data
- When Local AI is active: **nothing leaves the machine at all**
- Single-user, single Windows machine, no server component

---

## 2. User

| Attribute | Detail |
|---|---|
| Name | Juan Perez |
| Age | 70 |
| Role | Senior DBA |
| Company | Softtek, Mexico |
| Experience | 30+ years SQL Server administration |
| Language | Bilingual — Spanish (primary), English |
| Technical level | Expert — SSMS, DMVs, internals, performance tuning |
| Security posture | Very security-conscious. Expects all controls to be visible and explainable |
| Device | Windows PC (work or personal) |

### Daily priorities (design order)
1. **Server health** — CPU, memory, blocking, waits, I/O
2. **Data quality** — duplicates, referential integrity, inconsistencies
3. **Business queries** — sales, inventory, HR (on demand)

### Design implications

- Server Performance is **first** everywhere: sidebar, welcome chips, documentation
- Performance/DMV strip is **collapsed by default** — the DBA already knows the DMV; they want the result
- Business SQL strip is **expanded by default** — the DBA verifies every generated query
- DMV source tags appear in the result header so the DBA can reproduce the query in SSMS
- Minimum 15px body text — readable without strain
- Professional tool aesthetics — no consumer app styling
- Spanish is the default language
- The read-only policy must be visually reinforced at all times
- The active AI provider must always be visible in the topbar

---

## 3. Architecture

```
Windows Machine
└── SQL Assistant (Electron .exe)
    ├── Next.js 15 frontend     (UI — TypeScript, CSS Modules)
    ├── Fastify backend         (API server — TypeScript)
    ├── SQLite                  (local config: connections, history, settings)
    └── shared/types.ts         (shared type contracts)

SQL Server (existing, never modified — read-only access)

AI Layer — switchable at runtime:
  ☁  External: Anthropic Claude API   (internet required)
  ⚙  Local:    Ollama on localhost     (fully offline, no data leaves machine)
```

### Data privacy

| Provider | What leaves the machine |
|---|---|
| External (Claude) | Table names, column names, data types, and the user's question |
| Local (Ollama) | Nothing. Zero external network calls. |

DMV results (server performance metrics) never leave the machine regardless of provider. No telemetry, no analytics, no usage data sent anywhere.

### Monorepo workspace layout

```
sql-ai-assistant/
├── shared/          # @sql-assistant/shared — TypeScript interfaces only
├── backend/         # Fastify API — TypeScript
├── frontend/        # Next.js 15 — TypeScript + CSS Modules
└── electron/        # Electron shell — plain JavaScript
```

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop shell | Electron 30 | Windows 10/11 x64 only. Main process stays JavaScript. |
| Frontend framework | Next.js 15 + React 18 | App Router. Static export (`output: 'export'`) for Electron. |
| Frontend language | TypeScript 5 | Strict mode. All components `.tsx`. |
| Frontend styling | **CSS Modules + `clsx`** | No Tailwind. One `.module.css` per component. Design tokens in `styles/tokens.css`. |
| Backend framework | Fastify 4 | TypeScript. Listens on `127.0.0.1` only. |
| Backend language | TypeScript 5 | Strict mode. All files `.ts`. Dev: `tsx watch`. Prod: compiled via `tsc`. |
| Shared types | `shared/types.ts` | Single source of truth. Imported by both frontend and backend. |
| Local config DB | SQLite via `better-sqlite3` | WAL mode. Stores connections, query history, settings. |
| SQL Server driver | `mssql` (tedious) | Read-only connections only. Mutation guard in code. |
| External AI | Anthropic Claude API | `@anthropic-ai/sdk`. Models: `claude-sonnet-4-5`, `claude-opus-4-5`. |
| Local AI | Ollama REST API | `http://localhost:11434`. Models: `deepseek-coder`, `qwen2.5-coder`, `codellama`, `llama3`, `mistral`. |
| AI abstraction | `AIProvider` interface | `ClaudeProvider` and `OllamaProvider` implement it. Query pipeline is provider-agnostic. |
| Authentication | TOTP via `otplib` | 6-digit codes, 30-second window. Rate-limited: 5 attempts then 5-min lockout. |
| Credential storage | `electron-store` + `safeStorage` | AES-256 tied to the OS user account. |
| Auto-update | `electron-updater` | GitHub Releases. Silent background download. User prompted to restart. |
| Packaging | `electron-builder` | NSIS one-click installer for Windows. |
| Syntax highlighting | `shiki` | SQL highlighting in the SQL strip panel. |
| State management | `@tanstack/react-query` | Server state. No global client state library needed. |
| Form handling | `react-hook-form` | Connection form, settings forms. |
| Fonts | IBM Plex Sans + IBM Plex Mono | Loaded from Google Fonts. |

---

## 5. Design System

All design tokens are defined once in `frontend/styles/tokens.css` as CSS custom properties and consumed via `var(--token-name)` in every `.module.css` file. No hardcoded color or spacing values anywhere in component files.

### Color tokens

| Token | Value | Used for |
|---|---|---|
| `--color-topbar` | `#1B3A5C` | Top navigation bar background |
| `--color-topbar-text` | `#FFFFFF` | Top bar text and icons |
| `--color-accent` | `#2B6CB0` | Primary buttons, links, focus rings |
| `--color-accent-hover` | `#1A56A0` | Button hover state |
| `--color-performance` | `#6D28D9` | **Purple — DMV/performance label exclusively** |
| `--color-bg` | `#F2F5F9` | App background |
| `--color-surface` | `#FFFFFF` | Cards, panels, modal backgrounds |
| `--color-border` | `#D1D9E6` | All borders |
| `--color-text-primary` | `#1A202C` | Body text |
| `--color-text-secondary` | `#4A5568` | Labels, hints, secondary content |
| `--color-text-muted` | `#718096` | Placeholder text, timestamps |
| `--color-sql-bg` | `#0F1B2D` | SQL/DMV code panel background |
| `--color-sql-text` | `#D4D4D4` | SQL code text |
| `--color-success` | `#065F46` | Success text |
| `--color-success-bg` | `#D1FAE5` | Success background |
| `--color-error` | `#991B1B` | Error text |
| `--color-error-bg` | `#FEE2E2` | Error background |
| `--color-warning` | `#92400E` | Warning text |
| `--color-warning-bg` | `#FEF3C7` | Warning background |

### Typography tokens

| Token | Value |
|---|---|
| `--font-sans` | `'IBM Plex Sans', system-ui, sans-serif` |
| `--font-mono` | `'IBM Plex Mono', 'Courier New', monospace` |
| `--text-xs` | `12px` |
| `--text-sm` | `13px` |
| `--text-body` | `15px` (minimum per USE-01) |
| `--text-md` | `16px` |
| `--text-lg` | `18px` |
| `--text-xl` | `22px` |

### Spacing tokens

`--space-1` through `--space-10`: 4px increments (4, 8, 12, 16, 20, 24, 32, 40).

### Other tokens

| Token | Value | Notes |
|---|---|---|
| `--radius-sm` | `4px` | Small elements |
| `--radius-md` | `6px` | Inputs, buttons |
| `--radius-lg` | `8px` | Cards, panels |
| `--radius-xl` | `12px` | Badges, pills |
| `--border` | `1px solid var(--color-border)` | Default border shorthand |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Subtle card shadow |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.10)` | Elevated panel shadow |
| `--transition` | `150ms ease` | All hover/focus transitions |

### CSS Modules rules

1. One `.module.css` file per component — never share a module between two components
2. All colors, spacing, and font sizes via `var(--token)` — never hardcoded values
3. Use `clsx` for conditional class combinations: `clsx(styles.btn, isActive && styles.btnActive)`
4. No global class names inside `.module.css` files — use `globals.css` only for resets and base typography
5. All interactive elements must have `min-height: 44px` (USE-02)
6. All transitions via `var(--transition)` for consistency

---

## 6. Screens & UI

### Screen 1 — Login (TOTP)

- Shown on every app launch
- Single input: 6-digit code field, auto-focus on open
- Ctrl+Enter or tap Submit to verify
- After 5 failed attempts: lock with 5-minute countdown timer visible
- No "remember me" — code required every launch

### Screen 2 — First Run Setup (TOTP QR)

- Shown only once — the very first time the app launches on a new installation
- Displays a QR code for the user to scan with Google Authenticator
- User confirms by entering their first valid 6-digit code
- After confirmation: marked complete in `electron-store`, never shown again

### Screen 3 — Main Query Screen

**Topbar:**
- App name/logo left
- AI provider badge right — always visible, clickable, navigates to Settings → AI Provider
  - `☁ Claude` in blue when External AI is active
  - `⚙ Local` in green when Local AI is active
- Language toggle (ES / EN) right

**Sidebar — categories in this exact order:**
1. **Server Performance** — purple color, always first, always visible on launch
2. Data Quality
3. Sales & Billing
4. Inventory
5. Human Resources

**Welcome state (before first query):**
- Value proposition subtitle: *"Instant SQL Server diagnostics in natural language — performance, blocking, indexes, memory and more. The database is never modified."*
- 6 example chips (4 performance, 2 business):
  1. ⚡ Which queries are consuming the most CPU right now?
  2. 🔒 Are there any active blocks or deadlocks?
  3. ⏱ Most expensive wait types on the server
  4. 💾 How is memory usage looking?
  5. ⚠ Are there customers with duplicate RFC?
  6. 📊 Sales by month this year

**Query input:**
- Large textarea, prominent
- Submit button + Ctrl+Enter keyboard shortcut
- Connection selector (which SQL Server to query)
- Read-only policy badge always visible below the input — non-dismissible

**SQL Strip (below every result):**

| Question type | Default state | Label |
|---|---|---|
| Business (T-SQL) | Expanded | "SQL generado" / "Generated SQL" |
| Performance (DMV) | Collapsed | "Consulta DMV" / "DMV Query" |

- Full syntax highlighting via `shiki`
- "Copy for SSMS" button on every strip
- Expand/collapse via CSS `max-height` transition — no JS layout recalculation
- DMV source tags (e.g. `sys.dm_os_wait_stats`) shown in the result header, not in the strip

**Result panel — four types (determined automatically by backend):**

| Type | Renders as |
|---|---|
| `table` | Sortable data grid + CSV export button |
| `text` | Formatted prose / narrative |
| `mixed` | Warning notice box + data table |
| `performance` | KPI summary cards + data table with progress bars + CSV export |

Progress bars in performance results: green ≥ 90%, amber 70–89%, red < 70%.

### Screen 4 — Settings → Connections

- List of saved SQL Server connections
- Add / Edit / Delete / Test connection
- Fields: display name, host, port (default 1433), database name, username, password
- "Test Connection" button verifies reachability before saving
- Passwords stored encrypted via `safeStorage` — never visible after entry

### Screen 5 — Settings → AI Provider

- Toggle: **External (Anthropic Claude)** / **Local (Ollama)**
- When **External** selected:
  - Model dropdown: `claude-sonnet-4-5` (default), `claude-opus-4-5`
  - Anthropic API key field (masked, stored encrypted)
- When **Local** selected:
  - Ollama URL field (default: `http://localhost:11434`)
  - Model field — populated from Ollama after "Test connection", or typed manually
  - "Test connection" button — calls `/api/tags`, shows ✓ + model list or ✗ + error
  - Hint: *"Local AI runs entirely on this machine. No data is sent externally."*
- **Save** button — persists to SQLite, takes effect immediately with no app restart

### Screen 6 — Settings → Preferences

- Language toggle (ES / EN) — applies immediately to all labels
- (Future: theme, font size)

---

## 7. Functional Requirements

### AUTH — Authentication

| ID | Requirement |
|---|---|
| AUTH-01 | On first launch, generate and display a TOTP QR code for the user to scan with Google Authenticator |
| AUTH-02 | Store the TOTP secret encrypted via `electron-store`. Never store it in plain text. |
| AUTH-03 | On every subsequent launch, show the login screen and require a valid 6-digit TOTP code before proceeding |
| AUTH-04 | Issue a short-lived in-memory session token after successful login. Token expires when the app closes. |
| AUTH-05 | Lock out after 5 failed attempts for 5 minutes. Show a countdown timer during lockout. |

### CONN — Connection Management

| ID | Requirement |
|---|---|
| CONN-01 | Users can add, edit, and delete SQL Server connections |
| CONN-02 | Each connection stores: display name, host, port, database name, username, encrypted password |
| CONN-03 | A "Test Connection" button verifies reachability before saving |
| CONN-04 | Passwords are stored using Electron `safeStorage` (AES-256, tied to OS user account) |
| CONN-05 | Multiple connections can be saved; one is active at a time |
| CONN-06 | The connection selector is always visible in the query screen |

### SCHEMA — Schema Introspection

| ID | Requirement |
|---|---|
| SCHEMA-01 | On first query for a connection, introspect all tables and columns from `INFORMATION_SCHEMA` |
| SCHEMA-02 | Schema is cached in-process for 10 minutes (configurable via settings) |
| SCHEMA-03 | Only table names, column names, data types, and primary key flags are captured — never row data |
| SCHEMA-04 | Schema is passed as compact JSON in the AI system prompt |

### QUERY — Query Pipeline

| ID | Requirement |
|---|---|
| QUERY-01 | POST /api/query accepts: question (text), connectionId (int), language ('es' or 'en') |
| QUERY-02 | The pipeline: load schema → build system prompt → call AI provider → parse response → execute SQL → return result |
| QUERY-03 | If the AI response cannot be parsed as valid JSON, fall back gracefully and display the raw text as a text response |
| QUERY-04 | Every query is logged to `query_history` with: question, generated SQL, query type, response type, duration (ms), row count, language |
| QUERY-05 | The mutation guard rejects any SQL containing INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, EXEC, or EXECUTE — regardless of source |
| QUERY-06 | The backend returns: sql, queryType, responseType, columns, rows, textSummary, dmvSources, durationMs |

### SQL-STRIP — SQL/DMV Panel

| ID | Requirement |
|---|---|
| SQL-01 | Every query response shows a SQL strip below the result |
| SQL-02 | Business queries: strip expanded by default, label "SQL generado" / "Generated SQL" |
| SQL-03 | DMV/performance queries: strip collapsed by default, label "Consulta DMV" / "DMV Query" |
| SQL-04 | "Copy for SSMS" button copies the raw SQL to the clipboard |
| SQL-05 | Expand/collapse uses CSS `max-height` transition only — no JS layout recalculation |
| SQL-06 | DMV source tables appear as tags in the result header, not in the strip |

### RESULTS — Result Rendering

| ID | Requirement |
|---|---|
| RES-01 | `table` type renders a sortable data grid. Clicking a column header sorts ascending; clicking again sorts descending. |
| RES-02 | `text` type renders narrative prose with line breaks respected |
| RES-03 | `mixed` type renders a warning notice box above a data table |
| RES-04 | `performance` type renders KPI summary cards for key metrics, followed by a data table with visual progress bars |
| RES-05 | Progress bars use color coding: green ≥ 90%, amber 70–89%, red < 70% |
| RES-06 | All result types with table data show a "Export CSV" button |
| RES-07 | CSV export downloads the result as a `.csv` file using the browser download API |

### WELCOME — Welcome State

| ID | Requirement |
|---|---|
| WEL-01 | When no query has been submitted yet, show the value proposition subtitle and 6 example chips |
| WEL-02 | Chips are: 4 performance questions first, then 2 business questions |
| WEL-03 | Clicking a chip pre-fills the query input and submits immediately |

### HIST — Query History

| ID | Requirement |
|---|---|
| HIST-01 | Every query is stored in `query_history` with timestamp |
| HIST-02 | History is accessible from the sidebar |
| HIST-03 | Clicking a history item re-populates the input and shows the previous result |

---

## 8. Performance Diagnostics Requirements

These are the core diagnostic capabilities the app must support. Each maps to one or more SQL Server DMVs.

| ID | Capability | Primary DMVs |
|---|---|---|
| PERF-01 | CPU usage — top queries by CPU right now | `dm_exec_query_stats`, `dm_exec_sql_text`, `dm_exec_requests` |
| PERF-02 | Memory — pressure, PLE, buffer pool, buffer cache hit ratio, page reads/writes/sec, lazy writes | `dm_os_sys_memory`, `dm_os_buffer_descriptors`, `dm_os_performance_counters` |
| PERF-03 | Active blocking — blocking chains, root blocker, wait time | `dm_exec_requests`, `dm_os_waiting_tasks`, `dm_exec_sessions` |
| PERF-04 | Wait stats — top waits excluding noise, with diagnosis. Memory waits and parallelism waits as dedicated subcategories. | `dm_os_wait_stats` |
| PERF-05 | Missing indexes — optimizer suggestions ordered by estimated impact | `dm_db_missing_index_details`, `dm_db_missing_index_group_stats` |
| PERF-06 | I/O latency — per file, read/write latency with progress bars. Includes disk free space. | `dm_io_virtual_file_stats`, `master_files`, `dm_os_volume_stats` |
| PERF-07 | Active sessions — SPID, login, host, duration, status, CPU, memory | `dm_exec_sessions`, `dm_exec_requests` |
| PERF-08 | Long-running queries — active, with text, duration, waits, resource usage | `dm_exec_requests` |
| PERF-09 | tempdb — space usage, version store, allocation page contention | `dm_db_task_space_usage`, `dm_db_file_space_usage` |
| PERF-10 | Index fragmentation — with REBUILD vs REORGANIZE thresholds (5%/30%) | `dm_db_index_physical_stats` |
| PERF-11 | Outdated statistics — last update date, rows modified since | `sys.stats`, `dm_db_stats_properties` |
| PERF-12 | Deadlock history — from Extended Events or default trace | `system_health` session |
| PERF-13 | Database disk usage — data and log file sizes, auto-growth rate | `dm_os_volume_stats`, `sp_spaceused` |
| PERF-14 | SQL Agent jobs — last run, duration, result, next scheduled run | `msdb.dbo.sysjobhistory` |
| PERF-15 | Active connections by application/login/hostname | `dm_exec_sessions` |
| PERF-16 | Plan cache pollution — single-use plans, recommendation for optimize for ad hoc workloads | `dm_exec_cached_plans` |
| PERF-17 | Backup status — last full/differential/log backup per database, age | `msdb.dbo.backupset` |
| PERF-18 | DMV strip behavior — collapsed by default, label "DMV Query", sources shown in result header | — |
| PERF-19 | Summary KPI cards — current values for key metrics in performance results | — |
| PERF-20 | Progress bars — color-coded (green/amber/red) for percentages and latencies | — |
| PERF-21 | Buffer Cache Hit Ratio — with threshold indicators (< 95% = red, 95-98% = amber, ≥ 99% = green) | `dm_os_performance_counters` |
| PERF-22 | Reads/sec, Writes/sec, Lazy writes/sec — with note that these are cumulative since last restart | `dm_os_performance_counters` |
| PERF-23 | Recompilations — SQL Re-Compilations/sec counter + queries with highest recompile count. Includes causes and corrective actions. | `dm_os_performance_counters`, `dm_exec_query_stats` |
| PERF-24 | Parallelism — CXPACKET/CXCONSUMER waits, current MAXDOP and cost threshold values, tuning recommendations | `dm_os_wait_stats`, `sys.configurations` |
| PERF-25 | Unused indexes — not used since last restart, with warning about data reset on restart | `dm_db_index_usage_stats`, `sys.indexes`, `sys.objects` |
| PERF-26 | Duplicate indexes — same key columns in same order, grouped per table | `sys.indexes`, `sys.index_columns`, `sys.objects` |
| PERF-27 | Query Store (conditional) — detects if enabled; if yes, shows regressed queries, forced plans, top queries. If not enabled, shows clear message. | `query_store_query`, `query_store_plan`, `query_store_runtime_stats` |
| PERF-28 | Security risks — sa login enabled, password policy disabled logins, excessive sysadmin/db_owner permissions, TRUSTWORTHY databases, active linked servers. Each with risk level (High/Medium) and recommendation. | `sys.sql_logins`, `sys.server_role_members`, `sys.databases`, `sys.servers` |

---

## 9. Non-Functional Requirements

### Performance

| ID | Requirement |
|---|---|
| PERF-NF-01 | Results must appear in under 10 seconds for typical questions using External AI on a standard network |
| PERF-NF-02 | Schema loading must complete in under 5 seconds on startup |
| PERF-NF-03 | The UI must remain responsive during all AI and database calls (async, non-blocking) |
| PERF-NF-04 | App must start and display the login screen in under 4 seconds |
| PERF-NF-05 | SQL strip collapse/expand must be instant — CSS transition only, no JS layout recalculation |
| PERF-NF-06 | DMV queries must execute on SQL Server in under 2 seconds — they query system views, not user tables |
| PERF-NF-07 | Local AI response time is hardware-dependent. UI must show a loading indicator with no timeout shorter than 120 seconds for local model requests. |

### Usability

| ID | Requirement |
|---|---|
| USE-01 | Minimum body text 15px |
| USE-02 | All interactive elements minimum 44px click area |
| USE-03 | High contrast between text and background (WCAG AA minimum) |
| USE-04 | Generated SQL always visible with full syntax highlighting for business questions |
| USE-05 | Keyboard shortcut Ctrl+Enter to submit a question |
| USE-06 | Language toggle (ES/EN) applies immediately to all visible labels — no page reload |
| USE-07 | The value proposition subtitle above the input reflects the DBA-first diagnostic focus |
| USE-08 | Example chips in the welcome state prioritize server performance questions (4 of 6 chips) |
| USE-09 | "Server Performance" is always the first sidebar category, in purple |
| USE-10 | DMV source tags in the result header allow the DBA to identify data sources and replicate queries in SSMS |
| USE-11 | The active AI provider is always visible in the topbar — the user never needs to open Settings to know which engine is running |

### Maintainability

| ID | Requirement |
|---|---|
| MAINT-01 | The backend is written in TypeScript 5 with strict mode enabled |
| MAINT-02 | All API response shapes are defined in `shared/types.ts` and imported by both frontend and backend — no duplicated type definitions |
| MAINT-03 | The `AIProvider` interface must allow adding new providers (OpenAI, Gemini, etc.) without modifying the query pipeline |

---

## 10. Security Requirements

| ID | Requirement |
|---|---|
| SEC-01 | TOTP authentication required on every app launch — no bypass |
| SEC-02 | TOTP secret stored encrypted via `electron-store`. Never stored in plain text. |
| SEC-03 | Rate limit: 5 failed TOTP attempts triggers 5-minute lockout |
| SEC-04 | Session token is in-memory only. Never persisted to disk. Expires when app closes. |
| SEC-05 | SQL Server passwords encrypted using Electron `safeStorage` (AES-256, OS user-bound) |
| SEC-06 | Anthropic API key encrypted in `electron-store` |
| SEC-07 | No credentials ever stored in plain text in SQLite or any config file |
| SEC-08 | Mutation guard in `sqlserver.ts` — rejects any SQL containing INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, EXEC, EXECUTE regardless of origin |
| SEC-09 | Fastify server listens on `127.0.0.1` only — never `0.0.0.0` |
| SEC-10 | Electron `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in all BrowserWindow instances |
| SEC-11 | IPC: use `contextBridge` only — expose named channels, no direct Node.js access in renderer |
| SEC-12 | Content Security Policy set on all window responses |
| SEC-13 | SQL Server connections use `encrypt: true` (TLS) |
| SEC-14 | Only schema metadata sent to Claude API — never row data, credentials, or DMV results |
| SEC-15 | When Local AI is active: zero external network calls from the app |
| SEC-16 | No telemetry, analytics, crash reporting, or usage data sent anywhere |
| SEC-17 | `ANTHROPIC_API_KEY` must never appear in source control |
| SEC-18 | The read-only policy badge is always visible in the UI and non-dismissible |

### Required SQL Server permissions

The read-only service account (`sa_readonly`) must have these grants before the app can function:

```sql
GRANT VIEW SERVER STATE   TO sa_readonly;   -- required for ALL performance/DMV queries
GRANT VIEW DATABASE STATE TO sa_readonly;   -- required for database-level DMVs
GRANT VIEW ANY DEFINITION TO sa_readonly;   -- required for PERF-28 security risk queries
GRANT SELECT ON SCHEMA::dbo TO sa_readonly; -- required for business data queries
```

---

## 11. Response Types

The backend determines response type automatically. The user never selects it. Both AI providers must return the same JSON envelope.

### AI response envelope (JSON)

```json
{
  "type": "dmv" | "business",
  "sql": "<complete T-SQL or DMV query>",
  "responseType": "table" | "text" | "mixed" | "performance",
  "textSummary": "<narrative — required for text, mixed, performance>",
  "dmvSources": ["sys.dm_exec_query_stats", "..."]
}
```

### Decision logic

```
question → AI provider
  ↓
if question is about: CPU, memory, blocking, waits, indexes, I/O, sessions,
  jobs, backups, tempdb, fragmentation, statistics, buffer cache, reads/writes,
  recompilations, parallelism, CXPACKET, unused indexes, duplicate indexes,
  Query Store, security risks, server performance
  → type: "dmv", responseType: "performance"
    strip: collapsed, label: "DMV Query"

else if response has rows AND explanatory text/warning
  → type: "business", responseType: "mixed"

else if response has only rows
  → type: "business", responseType: "table"

else
  → type: "business", responseType: "text"
```

### Type 1 — Table
Sortable grid, CSV export. Used for business queries returning rows.

### Type 2 — Text
Narrative prose. Used for analytical or explanatory answers.

### Type 3 — Mixed
Warning box + data table. Used for data quality issues, blocking chains, anything needing both context and data.

### Type 4 — Performance
KPI summary cards + data table with progress bars. Used for all DMV/server health responses. Strip collapsed. Badge color: purple (`#6D28D9`).

---

## 12. Data Model

### Table: `connections`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT NOT NULL | Display name, e.g. `PROD_ERP_2025` |
| `host` | TEXT NOT NULL | Server hostname or IP |
| `port` | INTEGER | Default 1433 |
| `database_name` | TEXT NOT NULL | Target database |
| `username` | TEXT NOT NULL | SQL Server login |
| `password_encrypted` | BLOB | Encrypted via `safeStorage` |
| `is_active` | INTEGER | 0 or 1 — currently selected |
| `created_at` | TEXT | ISO 8601 |
| `last_tested_at` | TEXT | Nullable |

### Table: `query_history`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `connection_id` | INTEGER | FK → connections.id |
| `question` | TEXT | Original natural language question |
| `generated_sql` | TEXT | T-SQL or DMV query produced by AI |
| `query_type` | TEXT | `'dmv'` or `'business'` |
| `response_type` | TEXT | `'table'`, `'text'`, `'mixed'`, `'performance'` |
| `duration_ms` | INTEGER | Total pipeline duration |
| `row_count` | INTEGER | Rows returned |
| `created_at` | TEXT | ISO 8601 |
| `language` | TEXT | `'es'` or `'en'` |

### Table: `settings` (key-value)

| Key | Default | Description |
|---|---|---|
| `language` | `'es'` | App UI language |
| `anthropic_model` | `'claude-sonnet-4-5'` | Claude model to use |
| `schema_cache_ttl_min` | `'10'` | Schema cache TTL in minutes |
| `ai_provider` | `'external'` | `'external'` or `'local'` |
| `local_model` | `'deepseek-coder'` | Ollama model name |
| `ollama_url` | `'http://localhost:11434'` | Ollama base URL |

---

## 13. AI Provider System

### Interface

Both providers implement the same interface:

```typescript
interface AIProvider {
  generateSQL(args: {
    question: string;
    schema:   SchemaTable[];
    language: string;
  }): Promise<AIResponse>;
}
```

### System prompt

Sent identically to both Claude and Ollama:

```
You are a Senior DBA assistant for Microsoft SQL Server.
PRIMARY role: server performance diagnostics (CPU, memory, locks, wait stats, I/O,
index fragmentation, active sessions, SQL Agent jobs, tempdb, security).
SECONDARY role: business data queries (sales, HR, inventory).

Respond ONLY with a valid JSON object — no markdown, no preamble, no code fences:
{
  "type": "dmv" | "business",
  "sql": "<complete T-SQL or DMV query>",
  "responseType": "table" | "text" | "mixed" | "performance",
  "textSummary": "<narrative — required for text, mixed, performance>",
  "dmvSources": ["sys.dm_...", "..."]
}

NEVER generate: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, EXEC, EXECUTE.
Respond in [language].

Schema:
[compact JSON schema]
```

### Provider switching

- The active provider is read from the `settings` SQLite table on every request
- Switching in Settings → AI Provider takes effect on the **next query** — no restart
- If Local AI is unreachable: show error `"Local AI is not running. Start Ollama or switch to External AI in Settings."`

### Recommended local models

| Model | Quality for SQL | Size |
|---|---|---|
| `deepseek-coder` | ★★★ Best | ~4.7 GB |
| `qwen2.5-coder` | ★★★ Excellent | ~4.0 GB |
| `codellama` | ★★☆ Good | ~3.8 GB |
| `llama3` | ★☆☆ Adequate | ~4.7 GB |
| `mistral` | ★☆☆ Adequate | ~4.1 GB |

> Without a GPU: expect 15–60 second response times. With a modern GPU: 2–5 seconds.

---

## 14. Internationalization

Default language: **Spanish**. The language toggle applies immediately with no reload.

| Spanish | English |
|---|---|
| Rendimiento del servidor | Server Performance |
| Consulta DMV | DMV Query |
| SQL generado | Generated SQL |
| Mostrar consulta | Show query |
| Ocultar consulta | Hide query |
| Copiar para SSMS | Copy for SSMS |
| Proveedor de IA | AI Provider |
| IA Externa (Claude) | External AI (Claude) |
| IA Local (Ollama) | Local AI (Ollama) |
| Probar conexión | Test connection |
| Conectado · N modelos encontrados | Connected · N models found |
| IA Local no está ejecutándose | Local AI is not running |
| Guardar | Save |
| Guardando… | Saving… |
| Sesiones activas | Active Sessions |
| Bloqueos activos | Active Blocks |
| Índices no usados | Unused Indexes |
| Índices duplicados | Duplicate Indexes |
| Riesgos de seguridad | Security Risks |
| Query Store no habilitado | Query Store not enabled |
| Recompilaciones | Recompilations |
| Problemas de paralelismo | Parallelism Issues |
| Exportar CSV | Export CSV |

---

## 15. Auto-Update

- Uses `electron-updater` pointed at GitHub Releases
- On every app launch: checks for new release silently in the background
- If update available: downloads silently without interrupting the user
- When download completes: shows non-intrusive prompt — *"A new version is ready. Restart to update."*
- User can defer indefinitely or click to restart
- No manual download ever required
- Update does **not** touch Ollama or local AI models

---

## 16. Out of Scope

These are explicitly **not** built in this version:

- Continuous background monitoring or automatic alerts
- Real-time dashboards with historical trend charts
- Modifying SQL Server configuration (`sp_configure`, `ALTER SERVER CONFIGURATION`)
- Executing maintenance commands (`DBCC`, `UPDATE STATISTICS`, index rebuild jobs)
- Multi-user access or any server-side component
- AI providers other than Anthropic Claude and Ollama
- macOS or Linux support
- Any feature that writes, modifies, or deletes data in any database

---

## 17. Use Cases

### Server Performance (PRIMARY)

| Question | Response type | Key DMVs |
|---|---|---|
| Which queries are consuming the most CPU right now? | Performance | `dm_exec_query_stats` |
| How is server memory usage? Is there pressure? | Performance | `dm_os_sys_memory`, `dm_os_performance_counters` |
| Are there any active blocks or deadlocks? | Mixed | `dm_exec_requests`, `dm_os_waiting_tasks` |
| What are the most expensive wait types? | Performance | `dm_os_wait_stats` |
| What indexes are missing according to the optimizer? | Performance | `dm_db_missing_index_details` |
| Which files have the highest I/O latency? | Performance | `dm_io_virtual_file_stats` |
| What are the active sessions and what are they doing? | Performance | `dm_exec_sessions`, `dm_exec_requests` |
| Are there queries running for more than 5 minutes? | Performance | `dm_exec_requests` |
| How is tempdb doing? Is there contention? | Text | `dm_db_task_space_usage` |
| Which indexes have more than 30% fragmentation? | Performance | `dm_db_index_physical_stats` |
| Are there outdated statistics? | Performance | `dm_db_stats_properties` |
| When was the last backup for each database? | Performance | `msdb.dbo.backupset` |
| Which SQL Agent jobs failed in the last 24 hours? | Performance | `msdb.dbo.sysjobhistory` |
| How much free space does each database have? | Performance | `dm_os_volume_stats` |
| Is there plan cache pollution? | Text | `dm_exec_cached_plans` |
| Explain why this server is slow right now | Text | Multiple DMVs |
| What is the current Buffer Cache Hit Ratio? | Performance | `dm_os_performance_counters` |
| How many reads and writes per second? | Performance | `dm_os_performance_counters` |
| Are there excessive query recompilations? | Performance | `dm_os_performance_counters`, `dm_exec_query_stats` |
| Are there parallelism issues? What does CXPACKET look like? | Performance | `dm_os_wait_stats`, `sys.configurations` |
| Which indexes have not been used since last restart? | Performance | `dm_db_index_usage_stats` |
| Are there duplicate indexes? | Performance | `sys.indexes`, `sys.index_columns` |
| Is Query Store enabled? Which queries have regressed? | Performance | `query_store_query`, `query_store_runtime_stats` |
| Are there security risks on this SQL Server? | Text | `sys.sql_logins`, `sys.server_role_members`, `sys.databases` |

### Data Quality

| Question | Response type |
|---|---|
| Are there customer records with duplicate RFC? | Mixed |
| Are there orders where ship date is before order date? | Mixed |
| Show products with zero or missing price | Table |
| Are there sales orders with no customer assigned? | Mixed |
| Find inconsistencies between invoices and payments | Mixed |

### Sales & Billing

| Question | Response type |
|---|---|
| Total sales by month this year | Table |
| Customers who haven't ordered in the last 90 days | Table |
| Sales dropped a lot in March. Why? | Text |
| Compare this quarter vs same quarter last year | Table |

### Inventory

| Question | Response type |
|---|---|
| Products with fewer than 10 units in stock | Table |
| Explain what is happening with the Bomba A3 inventory | Text |

### Human Resources

| Question | Response type |
|---|---|
| Employees with the company for more than 10 years | Table |
| Average salary per department | Table |

---

*SQL AI Assistant — SPEC.md v1.4 · March 2026 · Maxon Torres — MaxonTorres.com · Confidential*