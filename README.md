# Enterprise Assistant

A context-configurable AI agent studio for enterprise demos and POCs, built by [MadStack](https://madstack.net).

Each company gets a pre-loaded agent environment at `agent.madstack.net/[company]` — branded, pre-configured with skills and MCP tools, and ready to use on arrival. The root serves a blank scratch studio for building new agents from nothing.

Web successor to [lattice-poc](../lattice-poc) — same mental model (personas → modules → compiled system prompt), native web stack, no Docker required.

---

## UI

```
agent.madstack.net/findorff

  ┌─── [Findorff] by MadStack ──────────────────────────────────────────────┐
  │  [ Marketplace ]  [ Personas ]  [ Session ]             ● Active        │
  ├────────────────────────┬────────────────────────────────────────────────┤
  │  QC Analyst            │                                                 │
  │  Findorff · 2 mod · 19 │  > Compare HPLC Purity for XB-441              │
  │                        │                                                 │
  │  01 · Context Modules  │  Thinking...  ▾                                 │
  │  ☑ LIMS Analysis       │                                                 │
  │  ☑ QMS Investigation   │  Here are the cross-batch results:             │
  │                        │                                                 │
  │  02 · MCP Tools        │  | Batch   | Purity | Pass |                   │
  │  ☑ LIMS  6 tools ▾     │  |--------|--------|------|                   │
  │  ☑ QMS   8 tools ▾     │  | B-2401 | 98.4%  | ✓    |                   │
  │  ☑ Rosetta 5 tools ▾   │  | B-2402 | 97.1%  | ✓    |                   │
  │                        │                                                 │
  │  Context: 2,400 tokens │  > _                                            │
  │  [ Relaunch Agent → ]  │                                                 │
  └────────────────────────┴────────────────────────────────────────────────┘
```

Three tabs:
- **Marketplace** — browse and add GitHub skill/blueprint repos to the company
- **Personas** — create and configure personas; attach modules from added repos
- **Session** — review active modules + MCP tools, adjust for token budget, launch agent

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + API | Next.js 15 (App Router), deployed to Vercel |
| Chat | Vercel AI SDK · `streamText` with `maxSteps: 8` |
| Inference | OpenRouter (default) · Ollama (local) · Open WebUI (optional) |
| Database | Neon PostgreSQL (serverless, Vercel-integrated) |
| Context content | GitHub repos — `skills/*.md`, `blueprints/*.md` |
| Styling | Tailwind CSS + custom CSS vars (lattice palette) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Database Schema

All state lives in Neon PostgreSQL. The schema has three logical layers: **platform** (companies, personas, modules), **marketplace** (repos, modules, access), and **runtime** (sessions, chat history).

### Platform

```sql
companies (
  id               TEXT PRIMARY KEY,        -- URL slug e.g. 'findorff'
  name             TEXT NOT NULL,           -- display name
  description      TEXT,
  logo_url         TEXT,
  color            TEXT DEFAULT '#369996',  -- brand primary color (hex)
  brand_config     JSONB,                   -- { secondary_color, font, tagline,
                                            --   favicon_url, chat_welcome }
  base_context     TEXT,                    -- system prompt preamble
  default_persona_id TEXT → personas,
  admin_key        TEXT,                    -- bcrypt hash; ?key=xxx unlocks edit mode
  created_at       TIMESTAMPTZ DEFAULT NOW()
)

personas (
  id               TEXT PRIMARY KEY,        -- slug e.g. 'findorff-qc-analyst'
  company_id       TEXT → companies,
  name             TEXT NOT NULL,
  description      TEXT,
  scope            TEXT DEFAULT 'private',  -- private | team | public
  created_at       TIMESTAMPTZ DEFAULT NOW()
)

persona_modules (
  id               SERIAL PRIMARY KEY,
  persona_id       TEXT → personas ON DELETE CASCADE,
  repo_id          TEXT → repos,            -- NULL if manually authored
  path             TEXT,                    -- file path within repo
  type             TEXT,                    -- skill | blueprint | agent | command
  name             TEXT,
  description      TEXT,
  tokens           INTEGER,
  enabled          BOOLEAN DEFAULT true,
  content          TEXT                     -- cached markdown
)
```

### Marketplace

```sql
repos (
  id               TEXT PRIMARY KEY,        -- slug e.g. 'findorff-lims-skills'
  name             TEXT NOT NULL,
  description      TEXT,
  repo_url         TEXT,                    -- GitHub URL
  branch           TEXT DEFAULT 'main',
  owner            TEXT,                    -- GitHub org or user
  scope            TEXT DEFAULT 'private',  -- private | team | public
  verified         BOOLEAN DEFAULT false,   -- MadStack-verified repo
  module_count     INTEGER DEFAULT 0,       -- cached count from last sync
  synced_at        TIMESTAMPTZ
)

repo_modules (
  id               SERIAL PRIMARY KEY,
  repo_id          TEXT → repos ON DELETE CASCADE,
  path             TEXT NOT NULL,           -- 'skills/lims_analysis.md'
  type             TEXT,
  name             TEXT,
  description      TEXT,
  tokens           INTEGER,
  content          TEXT
)

company_repos (
  company_id       TEXT → companies,
  repo_id          TEXT → repos,
  added_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (company_id, repo_id)
)
```

### Tools

```sql
company_tools (
  id               SERIAL PRIMARY KEY,
  company_id       TEXT → companies,
  tool_id          TEXT,                    -- e.g. 'lims_search_samples'
  enabled          BOOLEAN DEFAULT true
)
```

### Runtime

```sql
sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       TEXT → companies,
  persona_id       TEXT,
  modules          JSONB,                   -- snapshot: [{ id, name, tokens }]
  tools            JSONB,                   -- snapshot: ['lims_search_samples', ...]
  system_prompt    TEXT,                    -- compiled at launch
  created_at       TIMESTAMPTZ DEFAULT NOW()
)

chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID → sessions ON DELETE CASCADE,
  role             TEXT,                    -- user | assistant | tool
  content          TEXT,
  parts            JSONB,                   -- Vercel AI SDK message parts
  created_at       TIMESTAMPTZ DEFAULT NOW()
)
```

### `brand_config` JSONB shape

```json
{
  "secondary_color": "#2d2d6e",
  "font": "inter",
  "tagline": "by MadStack",
  "favicon_url": null,
  "chat_welcome": "What can I help you with today?"
}
```

---

## Architecture

### Request flow

```
Browser → GET /[company]
  → Server Component: load companies + personas + modules + tools from Neon
  → Render CompanyStudio (client) with pre-loaded state

Browser → POST /api/chat  (on every message)
  → Read activeModuleIds + activeToolIds from request body
  → Validate against DB (prevent tool injection)
  → compileSystemPrompt(company, activeModules, toolIds)
  → streamText({ model, system, tools, messages })
  → stream back to client
```

### Auth model

Edit mode is unlocked via `?key=xxx` in the URL. The key is compared (bcrypt) against `companies.admin_key`. Without a valid key:
- All config changes are session-only (React state)
- Nothing persists to DB

With a valid key:
- Changes to personas, modules, tools persist via API routes
- Company branding updates persist

### Context compilation

```
persona.base_context
  + active persona_modules (ordered by type: skill → blueprint → agent → command)
  → compileSystemPrompt() → string
  → passed as system message to streamText
```

Each module contributes its `content` (markdown). The compiled prompt is identical in structure to what lattice-poc's `generate.py` produces.

### Tool registry

Tools are TypeScript functions registered centrally in `src/tools/`. The `company_tools` table controls which tools a company can access. At inference time, only tools with IDs present in both `company_tools` and the client's `activeToolIds` are passed to the model.

```
src/tools/
  lims.ts      — 6 tools  (search samples, get assay results, OOS, instruments, compare)
  qms.ts       — 8 tools  (batch release, deviations, CAPAs, specs, audits)
  rosetta.ts   — 5 tools  (normalize terms, convert units, resolve compound aliases)
```

Future: HTTP MCP servers for customer-hosted or live data systems.

### Branding

Company branding is fully DB-driven. `companies.color` sets the CSS `--brand` variable at render time. `brand_config` JSONB extends this with secondary colors, custom fonts, taglines, and welcome messages. Each company URL loads its own palette — no code changes needed to white-label a new deployment.

---

## Architectural Design Record

### ADR-001 · Vercel AI SDK over Open WebUI

**Decision**: Use Vercel AI SDK (`streamText`) as the chat harness instead of Open WebUI.

**Rationale**: The custom Next.js UI needs to inject a compiled system prompt and a runtime-selected tool set with each request. Open WebUI's API is a pass-through to an inference endpoint — it doesn't support per-request system prompt overrides or dynamic tool selection programmatically. The Vercel AI SDK gives full control over the system prompt, tool set, and streaming format within the same Next.js server.

**Trade-off**: No native MCP protocol support (tools are TypeScript, not stdio subprocesses). Mitigated by translating the existing Python MCP tools to TypeScript with identical query logic. HTTP MCP support can be added later.

### ADR-002 · Neon PostgreSQL over SQLite

**Decision**: Replace lattice-poc's SQLite with Neon serverless PostgreSQL.

**Rationale**: Vercel Functions are stateless — SQLite files don't survive between requests. Neon provides a serverless Postgres connection compatible with Vercel's edge runtime, with connection pooling via PgBouncer. The Vercel–Neon integration auto-injects `DATABASE_URL`.

### ADR-003 · URL-slug company routing

**Decision**: Company identity is encoded in the URL path (`/[company]`), not in auth tokens or session cookies.

**Rationale**: Demos are designed to be shareable links. `/findorff` just works — no login, no setup. Edit mode is unlocked additively via `?key=xxx`, keeping the default experience frictionless.

### ADR-004 · Client-supplied active tool/module IDs

**Decision**: The client sends `activeToolIds` and `activeModuleIds` with each chat message, rather than the server always reading DB defaults.

**Rationale**: Users can toggle tools and modules in the Session UI without re-fetching the page. The server validates all client-supplied IDs against the DB before using them, so this isn't a security issue — it just means a user cannot activate tools their company doesn't have access to.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL + OPENROUTER_API_KEY
npm run db:seed               # creates tables + seeds Findorff demo data
npm run dev
```

Open `http://localhost:3000/findorff`.

### Environment variables

```env
PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash   # or anthropic/claude-sonnet-4-5

DATABASE_URL=postgresql://...   # Neon (auto-injected by Vercel integration)
GITHUB_PAT=ghp_...              # Optional — for private context repos
```

---

## Relation to lattice-poc

| lattice-poc | enterprise-assistant |
|---|---|
| Open WebUI (Docker) | Chat built into Next.js |
| Lattice Manager (FastAPI) | Next.js API routes |
| MCPO + stdio subprocesses | TypeScript tool registry |
| SQLite `context.db` | Neon PostgreSQL |
| `registry/` local markdown files | GitHub repos + `repo_modules` table |
| `generate.py` → opencode.jsonc | `compile.ts` → `streamText` system prompt |
| `./lattice web` | `vercel deploy` |

---

## Deployment

```bash
npx vercel --prod
```

Set env vars in the Vercel dashboard. Point `agent.madstack.net` CNAME to Vercel. The Neon integration auto-populates `DATABASE_URL`.
