# Enterprise Assistant

A context-configurable AI agent studio for enterprise demos and POCs, built by [MadStack](https://madstack.net).

Each company gets a pre-loaded agent environment at `agent.madstack.net/[company]` — branded with its own color scheme and logo, pre-configured with context modules and MCP tools, and ready to use on arrival. The root (`/`) serves a blank scratch studio for building new agents.

---

## What it does

Enterprise Assistant lets you configure and run AI agents that have access to structured company data. Each company deployment gets:

- **A branded chat interface** — company colors, logo, and welcome message derived from a DB-stored config, no code changes needed to white-label
- **Context modules** — Markdown documents (skills, blueprints, agents, commands) that load into the system prompt, giving the agent domain knowledge
- **MCP tool servers** — the agent can call live data APIs (LIMS, QMS, Rosetta, or any HTTP MCP server you register)
- **Persona management** — multiple agent personas per company, each with its own module set
- **Session control** — per-session toggle of which modules and tool servers are active without changing DB defaults

---

## UI

```
agent.madstack.net/findorff

  ┌─── [Findorff] by MadStack ─────────────[ Marketplace ][ Personas ][ Session ]─┐
  ├──────────────────────────┬─────────────────────────────────────────────────────┤
  │  QC Analyst              │                                                      │
  │  Findorff · 2 mod · 19k  │  > Compare HPLC Purity for XB-441                   │
  │                          │                                                      │
  │  01 · Context Modules    │  Thinking…  ▾                                        │
  │  ☑ LIMS Analysis         │                                                      │
  │  ☑ QMS Investigation     │  Here are the cross-batch results:                   │
  │                          │                                                      │
  │  02 · MCP Tools          │  | Batch   | Purity | Pass |                         │
  │  ☑ LIMS  6 tools ▾       │  |--------|--------|------|                         │
  │  ☑ QMS   8 tools ▾       │  | B-2401 | 98.4%  | ✓    |                         │
  │  ☑ Rosetta 5 tools ▾     │  | B-2402 | 97.1%  | ✓    |                         │
  │                          │                                                      │
  │  Context: 2,400 tokens   │  > _                                                 │
  │  [ New Session → ]       │                                                      │
  └──────────────────────────┴─────────────────────────────────────────────────────┘
```

Three tabs above the session:

- **Marketplace** — add GitHub skill repos, register external MCP servers, enable/disable tool servers
- **Personas** — create and configure agent personas; attach, edit, and remove context modules
- **Session** — review active modules + tools, toggle for the current conversation, launch a fresh agent

---

## Features

### Chat
- **Streaming responses** with smooth scroll-lock (auto-scroll during generation, stays put when you scroll up to read)
- **ESC to stop** generation mid-stream
- **Steer mid-generation** — type a new message while the agent is running; it stops and redirects
- **Thinking blocks** — collapsible `<think>` reasoning panels when using reasoning models
- **Tool call badges** — inline display of which tools the agent called and their status
- **Markdown rendering** — tables, code blocks, inline code, headings, lists rendered correctly; monospace code blocks with proper ASCII chart alignment

### Context Modules
- Modules are Markdown documents attached to a persona — skills, blueprints, agent instructions, commands
- Loaded into the system prompt at inference time; token count shown per module
- Toggle individual modules per session without changing DB defaults
- Add modules from GitHub repos (auto-scanned), manually authored, or cloned from repo modules

### MCP Tool Servers

#### Built-in (TypeScript)
| Server | Tools | Description |
|---|---|---|
| LIMS | 6 | Lab samples, assay results, OOS detection, instrument status, cross-batch compare |
| QMS | 8 | Batch release, deviations, CAPAs, specifications, audit findings |
| Rosetta | 5 | Term normalization, unit conversion, compound alias resolution |

#### External MCP Servers (new)
- Register any HTTP MCP server by URL — the server must speak JSON-RPC 2.0
- On add: fetches `tools/list`, stores tool names + descriptions + input schemas in the DB
- **Rescan** button to re-fetch and update the stored tool list
- Enable/disable per server — only enabled servers' tools are available to the agent
- Tools are called live at inference time via `tools/call` proxy in the chat route
- Admin-required to persist; session-only without a key

### GitHub Repo Scanning (Context)
- Paste a GitHub repo URL in Marketplace → Add Repo
- Auto-scans all `.md` files in `skills/`, `blueprints/`, `context/`, and `agents/` folders
- Classifies each file by type based on folder path
- Stores content, name, token estimate, and file path as `repo_modules`
- Browse modules per repo, add individually or all-at-once to any persona
- Uses `GITHUB_TOKEN` env var for private repos (optional)

### Personas
- Multiple personas per company, each with its own module set
- **Set default** — mark which persona loads when a session starts (admin-gated)
- **Delete** — remove a persona and all its modules (admin-gated; cannot delete the default)
- **Inline edit** — edit any module's name, description, and full content in-place (persists to DB with admin key)
- Create new personas; add modules from repos or manually

### Marketplace
- **Search** across tool servers, repos, and modules
- **MCP Tool Servers** — enable/disable built-in TypeScript tool servers per company
- **External MCP Servers** — register, scan, rescan, enable/disable HTTP MCP servers
- **Context Repositories** — add GitHub repos, browse modules, add to personas
- **Custom Modules** — author a module directly in the UI with a Markdown textarea

### Branding
- Each company has a `color` (hex) and optional `brand_config` JSONB that drives all CSS variables
- Override specific CSS vars: `bg`, `surface`, `border`, `teal_ink`
- `logo_url` in `brand_config` shows a logo mark in the nav header
- `tagline`, `chat_welcome` customize the nav subtitle and agent greeting
- Zero code changes to white-label a new company — it's all DB rows

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + API | Next.js 15 (App Router), deployed to Vercel |
| Chat | Vercel AI SDK v4 · `streamText` with `maxSteps: 8` |
| Inference | OpenRouter (default) · Ollama (local) · Open WebUI (optional) |
| Database | Neon PostgreSQL (serverless, Vercel-integrated) |
| Context content | GitHub repos — `.md` files auto-scanned |
| MCP protocol | HTTP JSON-RPC 2.0 · `tools/list` + `tools/call` |
| Styling | Tailwind CSS + CSS custom properties (per-company theming) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Database Schema

### Platform

```sql
companies (
  id               TEXT PRIMARY KEY,        -- URL slug e.g. 'findorff'
  name             TEXT NOT NULL,
  description      TEXT,
  color            TEXT DEFAULT '#369996',  -- primary brand color (hex)
  brand_config     JSONB,                   -- { logo_url, tagline, chat_welcome,
                                            --   bg, surface, border, teal_ink }
  base_context     TEXT,                    -- system prompt preamble
  default_persona_id TEXT → personas,
  admin_key        TEXT,                    -- ?key=xxx unlocks edit mode
  created_at       TIMESTAMPTZ
)

personas (
  id               TEXT PRIMARY KEY,
  company_id       TEXT → companies,
  name             TEXT NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ
)

persona_modules (
  id               SERIAL PRIMARY KEY,
  persona_id       TEXT → personas CASCADE,
  repo_id          TEXT → repos,            -- NULL if manually authored
  path             TEXT,                    -- file path within repo
  type             TEXT,                    -- skill | blueprint | agent | command | context
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
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  repo_url         TEXT,                    -- GitHub URL
  owner            TEXT,
  scope            TEXT DEFAULT 'private',
  verified         BOOLEAN DEFAULT false,
  module_count     INTEGER DEFAULT 0
)

repo_modules (
  id               SERIAL PRIMARY KEY,
  repo_id          TEXT → repos CASCADE,
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

company_mcp_servers (
  id               SERIAL PRIMARY KEY,
  company_id       TEXT → companies CASCADE,
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,           -- HTTP MCP server endpoint
  transport        TEXT DEFAULT 'http',
  enabled          BOOLEAN DEFAULT true,
  tools            JSONB DEFAULT '[]',      -- [{ name, description, inputSchema }]
  last_scanned     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ
)
```

### Runtime

```sql
sessions (
  id               UUID PRIMARY KEY,
  company_id       TEXT → companies,
  persona_id       TEXT,
  modules          JSONB,
  tools            JSONB,
  system_prompt    TEXT,
  created_at       TIMESTAMPTZ
)

chat_messages (
  id               UUID PRIMARY KEY,
  session_id       UUID → sessions CASCADE,
  role             TEXT,
  content          TEXT,
  parts            JSONB,
  created_at       TIMESTAMPTZ
)
```

### `brand_config` JSONB shape

```json
{
  "logo_url":    "/madstack-icon.svg",
  "tagline":     "by MadStack",
  "chat_welcome": "AgentOS ready. What would you like to explore?",
  "bg":          "#fff7ed",
  "surface":     "#ffffff",
  "border":      "rgba(249,115,22,0.18)",
  "teal_ink":    "#c2410c"
}
```

---

## Architecture

### Request flow

```
Browser → GET /[company]
  → Server Component: load company + persona + modules + tools from Neon
  → Render CompanyStudio (client) with pre-loaded state

Browser → POST /api/chat  (on every message)
  → Validate activeModuleIds + activeToolIds against DB
  → Load enabled company_mcp_servers from DB
  → compileSystemPrompt(company, activeModules, toolIds)
  → Build tool set: builtin TypeScript tools + dynamic MCP proxy tools
  → streamText({ model, system, tools, messages })
  → stream back to browser
```

### Auth model

Edit mode is unlocked via `?key=xxx` in the URL. The key is compared against `companies.admin_key`. Without a valid key:
- Config changes are session-only (React state only)
- Nothing persists to the DB

With a valid key:
- Persona creates/edits/deletes persist
- Module adds/edits/removes persist
- Repo adds and MCP server registrations persist
- Tool enable/disable changes persist
- Company branding updates persist

### Context compilation

```
company.base_context
  + active persona_modules (ordered: skill → blueprint → agent → command → context)
  → compileSystemPrompt() → string
  → passed as system message to streamText
```

### Tool resolution at inference time

1. Built-in TypeScript tools — `getToolsForCompany(toolIds)` returns AI SDK tool definitions for enabled tool IDs
2. External MCP tools — load all `enabled = true` rows from `company_mcp_servers`; for each stored tool, create a dynamic AI SDK tool whose `execute` function POSTs `tools/call` to the server URL

Both sets are merged and passed to `streamText`. The model sees all tool names and can call any of them.

### External MCP proxy

```
Agent decides to call a tool from server "My Data API"
  → chat route calls: POST server.url
      { jsonrpc: "2.0", method: "tools/call",
        params: { name: "query_data", arguments: { … } } }
  → response: { result: { content: [{ type: "text", text: "…" }] } }
  → text returned to model as tool result
  → model continues generation
```

---

## Company deployments

| Company | Slug | Color | Description |
|---|---|---|---|
| AgentOS Demo | `demo` | `#f97316` (MadStack orange) | General-purpose demo with all tools enabled |
| Findorff | `findorff` | `#2563eb` | QC analyst — LIMS + QMS for pharma manufacturing |
| Lattice | `lattice` | `#212154` | Biologics intelligence — LIMS, QMS, Rosetta |
| Lancaster Investments | `lancaster-investments` | `#166534` | Portfolio monitoring and compliance |

---

## Admin access

Edit mode is unlocked by appending `?key=<admin_key>` to any company URL.

| Company | URL slug | Admin key |
|---|---|---|
| AgentOS Demo | `demo` | `demo-admin` |
| Findorff Demo | `findorff` | `findorff-admin` |
| Lattice | `lattice` | `lattice-admin` |
| Lancaster Investments | `lancaster-investments` | `lancaster-admin` |

**Examples:**
```
localhost:3000/demo/marketplace?key=demo-admin
localhost:3000/findorff/personas?key=findorff-admin
```

Keys are stored as plaintext in `companies.admin_key`. To change a key, update `scripts/seed.ts` and re-run `npm run db:seed`, or update the row directly in Neon.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL + OPENROUTER_API_KEY
npm run db:seed               # creates tables + seeds all four company deployments
npm run dev
```

Open `http://localhost:3000/demo` for the AgentOS demo, or `http://localhost:3000/findorff` for the Findorff deployment.

### Environment variables

```env
PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-r1-0528   # or anthropic/claude-sonnet-4-5

DATABASE_URL=postgresql://...   # Neon (auto-injected by Vercel integration)
GITHUB_TOKEN=ghp_...            # Optional — for private context repos
```

---

## Relation to lattice-poc

| lattice-poc | enterprise-assistant |
|---|---|
| Open WebUI (Docker) | Chat built into Next.js |
| Lattice Manager (FastAPI) | Next.js API routes |
| MCPO + stdio subprocesses | TypeScript tool registry + HTTP MCP proxy |
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

After deploying new schema changes (new tables), run the seed script once against the production database or apply the `CREATE TABLE IF NOT EXISTS` statements directly in Neon's SQL console.

---

## Architectural Design Record

### ADR-001 · Vercel AI SDK over Open WebUI

**Decision**: Use Vercel AI SDK (`streamText`) as the chat harness instead of Open WebUI.

**Rationale**: The custom Next.js UI needs to inject a compiled system prompt and a runtime-selected tool set with each request. Open WebUI's API is a pass-through — it doesn't support per-request system prompt overrides or dynamic tool selection programmatically. The Vercel AI SDK gives full control over the system prompt, tool set, and streaming format within the same Next.js server.

**Trade-off**: No native stdio MCP subprocess support. Mitigated by translating the existing Python MCP tools to TypeScript and by adding an HTTP MCP proxy for external servers.

### ADR-002 · Neon PostgreSQL over SQLite

**Decision**: Replace lattice-poc's SQLite with Neon serverless PostgreSQL.

**Rationale**: Vercel Functions are stateless — SQLite files don't survive between requests. Neon provides a serverless Postgres connection compatible with Vercel's edge runtime, with connection pooling via PgBouncer.

### ADR-003 · URL-slug company routing

**Decision**: Company identity is encoded in the URL path (`/[company]`), not in auth tokens or session cookies.

**Rationale**: Demos are designed to be shareable links. `/findorff` just works — no login, no setup. Edit mode is unlocked additively via `?key=xxx`.

### ADR-004 · Client-supplied active tool/module IDs

**Decision**: The client sends `activeToolIds` and `activeModuleIds` with each chat message.

**Rationale**: Users can toggle tools and modules in the Session UI without re-fetching the page. The server validates all client-supplied IDs against the DB before using them — a user cannot activate tools their company doesn't have access to.

### ADR-005 · HTTP MCP proxy over native MCP client

**Decision**: Implement external MCP server integration as a fetch-based proxy in the chat route rather than using the Vercel AI SDK's experimental MCP client.

**Rationale**: The experimental MCP client requires persistent subprocess connections which don't fit the stateless serverless function model. The HTTP proxy approach is stateless, works with any JSON-RPC 2.0 MCP server, and stores tool schemas in the DB so they're available without re-scanning on every request.
