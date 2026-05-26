# Enterprise Assistant — Plan v2

Web version of lattice-poc. Deployable to `agent.madstack.net`.

---

## What it is

A context-configurable AI agent studio. Each company gets a pre-loaded environment at `agent.madstack.net/[company]` (e.g. `agent.madstack.net/findorff`). The same app serves a blank scratch environment at the root `/`.

The lattice-poc runs locally with Open WebUI as the chat harness. This replaces all of that with a single Next.js app — no Docker, no Open WebUI, no iframes.

---

## URL structure

```
agent.madstack.net/             — scratch: build an agent from nothing
agent.madstack.net/findorff     — Findorff POC, pre-loaded and ready to chat
agent.madstack.net/[company]    — any other company slug
```

Each `[company]` route is the same app with different data pre-filled. The UI wrapper (header, colors, logo) pulls from the company record in the database.

---

## The UI — one page, collapsible stack

Single page. No tab switching. Collapsible sections stacked vertically, chat always visible at the bottom.

```
┌─────────────────────────────────────────────────────────┐
│  agent.madstack.net/findorff                            │
│  [Findorff logo]  [company name]                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ▼  Data                                                │
│     Files loaded into this agent's context.             │
│     Drag-and-drop zone + list of active files.          │
│                                                         │
│  ▼  Skills & Tools                                      │
│     Toggle list of skills (system prompt fragments)     │
│     and MCP tools (what the agent can query/do).        │
│                                                         │
│  ▼  Config                                              │
│     Persona name, system prompt preview (compiled),     │
│     model selector.                                     │
│                                                         │
│  [  Launch Agent  ]                                     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Chat                                           │   │
│  │  (always visible, live after launch)            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- On `agent.madstack.net/findorff`: sections arrive pre-filled and collapsed. User lands straight in chat with the agent already configured.
- On `agent.madstack.net/`: sections arrive empty and expanded. User builds from scratch.

---

## Stack

```
Frontend + API:   Next.js 15 (App Router) on Vercel
Chat:             Vercel AI SDK + OpenRouter (default) or Ollama (local)
Database:         Neon PostgreSQL (Vercel integration, free tier)
Context content:  GitHub repos (same pattern as lattice-poc — skills/*.md, blueprints/*.md)
MCP tools (v1):   Inline TypeScript tool definitions in the API route
MCP tools (v2):   HTTP MCP servers on Railway (for customer-hosted data)
Styling:          Tailwind CSS
```

No Docker. No separate backend service for v1. Three external services total: Vercel, Neon, Anthropic.

---

## Database schema

Mirrors the lattice-poc `context.db` schema, ported to Postgres.

```sql
-- Company presets
companies (
  id          TEXT PRIMARY KEY,   -- "findorff"
  name        TEXT,               -- "Findorff"
  description TEXT,
  logo_url    TEXT,
  color       TEXT,               -- brand hex for UI wrapper
  default_persona_id TEXT
)

-- GitHub repos containing .md skills/blueprints
context_repos (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  repo_url    TEXT,               -- null = local/built-in
  branch      TEXT DEFAULT 'main',
  local_path  TEXT,
  created_at  TIMESTAMPTZ
)

-- .md files scanned from repos
repo_modules (
  id          SERIAL PRIMARY KEY,
  repo_id     TEXT REFERENCES context_repos,
  path        TEXT,               -- "skills/lims-analysis.md"
  type        TEXT,               -- "skill" | "blueprint"
  name        TEXT,
  description TEXT,
  tokens      INT
)

-- Named bundles of modules
personas (
  id          TEXT PRIMARY KEY,
  company_id  TEXT REFERENCES companies,
  name        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ
)

-- Modules assigned to a persona
persona_modules (
  id          SERIAL PRIMARY KEY,
  persona_id  TEXT REFERENCES personas,
  repo_id     TEXT REFERENCES context_repos,
  path        TEXT,
  name        TEXT,
  tokens      INT,
  enabled     BOOLEAN DEFAULT true
)

-- Available tools per company
company_tools (
  id          SERIAL PRIMARY KEY,
  company_id  TEXT REFERENCES companies,
  tool_id     TEXT,               -- matches a key in the tools registry
  enabled     BOOLEAN DEFAULT true
)

-- Launched session snapshots
sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  TEXT REFERENCES companies,
  persona_id  TEXT REFERENCES personas,
  modules     JSONB,              -- snapshot of active modules at launch
  tools       JSONB,              -- snapshot of active tools at launch
  system_prompt TEXT,             -- compiled prompt
  created_at  TIMESTAMPTZ
)
```

---

## Tool registry

All possible tools live in the codebase. The `company_tools` table controls which ones a company has access to. No separate repos per customer.

```
src/tools/
  lims.ts           — query LIMS data
  qms.ts            — query QMS data
  rosetta.ts        — cross-system normalization
  workorder.ts      — work order queries (Findorff-specific)
  invoice.ts        — invoice reconciliation
  ...
```

At session launch, only the company's enabled tools are passed to the model. A customer never sees or calls tools outside their set.

**When does a customer need their own MCP server?**
Only when their live data can't come into this app's database — e.g. they want to connect a real SAP instance behind their firewall. That's v2: an HTTP MCP server they deploy on their infra, registered in `company_tools` with a URL instead of a local definition.

---

## API routes

Next.js serverless functions. Maps directly to what `manager/server.py` does in the lattice-poc.

```
POST  /api/chat                       — streaming chat (Vercel AI SDK)
GET   /api/companies/[slug]           — load company preset (branding + default persona)
GET   /api/personas                   — list personas
POST  /api/personas                   — create persona
GET   /api/personas/[id]              — persona detail + modules
POST  /api/personas/[id]/modules      — add module to persona
PATCH /api/personas/[id]/modules/[mid] — toggle enabled
POST  /api/launch                     — compile system prompt → return session id
GET   /api/repos                      — list context repos
POST  /api/repos                      — register GitHub repo (triggers scan)
POST  /api/repos/[id]/sync            — re-scan repo for module changes
GET   /api/tools                      — list available tools for a company
```

### /api/chat

Assembles the system prompt from the active session, registers the active tools, streams back the response.

```typescript
// Compiles: base context + active persona modules + tool descriptions
const systemPrompt = await compileSystemPrompt(sessionId)
const tools = await getSessionTools(sessionId)

// model resolved from PROVIDER env var (openrouter or ollama)
return streamText({
  model: resolveModel(),
  system: systemPrompt,
  tools,
  messages,
}).toDataStreamResponse()
```

### /api/launch

Takes a persona + enabled module ids + enabled tool ids → writes a session row with the compiled system prompt → returns the session id. The chat component then uses this session id for all subsequent messages.

---

## System prompt compilation

Same logic as `generate.py` + `_push_to_openwebui()` in the lattice-poc, now in TypeScript.

```
Session header (persona name, active modules list, active tools list)
  +
context.md (base always-on context, same as lattice-poc)
  +
skill_1.md content (frontmatter stripped)
  +
blueprint_1.md content (frontmatter stripped)
  +
...
```

The compiled prompt is stored in `sessions.system_prompt` so it's inspectable.

---

## Company-specific route

```typescript
// app/[company]/page.tsx
const company = await db.query(
  'SELECT * FROM companies WHERE id = $1', [params.company]
)
// 404 if not found

// Load default persona + modules
const persona = await db.query(
  'SELECT * FROM personas WHERE id = $1', [company.default_persona_id]
)

// Render: company wrapper (logo, color) + page with pre-filled sections collapsed
```

The company wrapper is just a header and a CSS variable for the brand color. Same React component, different data.

---

## v1 scope (ship this first)

Cut everything down to what's needed for a demo:

1. **`/[company]` route** — loads Findorff preset, chat is live on arrival
2. **`/api/chat`** — streaming chat with compiled system prompt + tools
3. **`/api/launch`** — compile and save session
4. **Config sidebar** — shows active persona, modules, tools (read-only for now)
5. **DB seed script** — seeds Findorff company + persona + modules + tools (mirrors `seed_databases.py`)
6. **Neon + Vercel setup** — deployed to `agent.madstack.net/findorff`

The collapsible Data and Skills sections are visible but read-only in v1 (showing what's pre-loaded, not editable).

---

## Architecture Decision Records

Key decisions made and why.

---

### ADR-001 — Next.js + Vercel over a separate frontend + backend split

**Decision:** Single Next.js app (App Router) deployed to Vercel. API routes live in the same repo as the UI.

**Alternatives considered:**
- Separate FastAPI backend + React frontend (like lattice-poc's `manager/server.py` + Open WebUI)
- Next.js frontend + FastAPI on Railway

**Rationale:** The lattice-poc splits UI and backend because Open WebUI is a third-party Docker app — there's no choice. Here we own the whole stack. Keeping it in one Next.js project means one deploy, one repo, shared types, and no CORS config. API routes on Vercel are sufficient for all v1 operations (DB queries, prompt compilation, streaming chat). The only reason to split later is if MCP tool servers need a persistent process (v2 — see ADR-004).

**Note on TypeScript:** The entire codebase is TypeScript. All API routes, components, tools, and DB queries are `.ts`/`.tsx`.

---

### ADR-002 — Neon PostgreSQL for runtime state, GitHub repos for context content

**Decision:** Neon (serverless Postgres) for all structured runtime data. GitHub repos for versioned `.md` skill and blueprint files.

**Alternatives considered:**
- GitHub repo for everything (configs stored as JSON files in a repo)
- PlanetScale / Supabase instead of Neon
- SQLite (what lattice-poc uses)

**Rationale:** SQLite works locally but not on serverless — no persistent filesystem on Vercel. GitHub as a database can version text content well but can't serve queries like "list all active sessions" or "which modules does persona X have enabled" without fetching and parsing files on every request. The split matches what the data actually is: structured relational state belongs in a DB; versioned prose content belongs in git. Neon was chosen over Supabase for its native Vercel integration and over PlanetScale for Postgres compatibility (same dialect as the migration target if we ever self-host). GitHub repos for context content preserves the lattice-poc pattern exactly — customers can PR their own skills.

---

### ADR-003 — Vercel AI SDK + Anthropic over Open WebUI

**Decision:** Build the chat UI natively in Next.js using Vercel AI SDK. No Open WebUI, no Docker, no iframes. OpenRouter is the default inference provider; Ollama is supported for local/offline use.

**Alternatives considered:**
- Embed Open WebUI at `agent-ui.madstack.net` in an iframe
- Self-host Open WebUI on a VPS alongside the Next.js app

**Rationale:** The lattice-poc uses Open WebUI because it has no chat UI of its own — it's a config tool that hands off to a third-party harness. The enterprise-assistant IS the product, so we own the chat UI directly. An iframe to Open WebUI would mean: Docker dependency, separate deployment, CORS/auth complexity, no control over styling or branding per company, and inability to wire config state into the chat without postMessage hacks. The Vercel AI SDK streaming implementation is ~20 lines. OpenRouter is kept as the default (same as lattice-poc) because it gives model flexibility without locking to a single provider. Ollama is supported for demos where data must stay fully local. Provider is resolved from the `PROVIDER` env var at runtime — no code change needed to switch.

---

### ADR-004 — Inline TypeScript tools (v1), HTTP MCP servers (v2)

**Decision:** v1 implements MCP tools as Vercel AI SDK `tool()` definitions in TypeScript, collocated with the API route. v2 moves customer-specific tools to HTTP MCP servers on Railway.

**Alternatives considered:**
- Start with HTTP MCP servers from day one
- Use MCPO (the lattice-poc's stdio-to-HTTP proxy) hosted on a VPS
- Implement only tool calling, never MCP protocol

**Rationale:** The lattice-poc runs MCP servers as stdio subprocesses — not possible on Vercel serverless functions (no persistent processes, no subprocess spawning). MCPO hosted on a VPS adds infra before there's any customer to justify it. The Vercel AI SDK tool interface is functionally identical to MCP tools from the model's perspective — same `name`, `description`, `parameters`, `execute` shape. The DB queries that power `lims_mcp.py` translate directly to TypeScript hitting Neon. For v1 (demo data in our own DB), there's no reason to add a separate server. The HTTP MCP pattern becomes necessary in v2 when a customer wants to connect their own live systems behind their firewall — at that point a Railway-hosted Python FastMCP server is the right call and `company_tools` already has a `url` field to support it.

---

### ADR-005 — Single-page collapsible UI over tabs or multi-page navigation

**Decision:** One page per company route. Configuration sections (Data, Skills, Config) are collapsible panels above a persistent chat interface.

**Alternatives considered:**
- Tab-based navigation (Chat / Skills / Context / Data / Inspect)
- Separate pages per section with a sidebar nav
- Config as a slide-over drawer

**Rationale:** The demo use case is a customer visiting `agent.madstack.net/findorff` and immediately seeing a working agent they can talk to. Tabs would hide the chat behind a navigation step. A single scrollable page with collapsed sections means the chat is always visible, the config is one click away to inspect, and the "launch" action is an explicit in-page button rather than a page transition. For the scratch flow at `/`, the same layout works with sections expanded by default — the user builds downward and launches at the bottom.

---

### ADR-006 — One tool registry, per-company access control

**Decision:** All tools are defined centrally in `src/tools/`. The `company_tools` table controls which tools each company can use. No separate repos or deployments per customer.

**Alternatives considered:**
- Separate tool repo per customer (each customer forks and deploys their own)
- Per-customer tool bundles loaded from their GitHub repos
- Tools defined in the company record as JSON config

**Rationale:** Separate repos per customer creates a deployment and versioning burden with no benefit for v1 — customers aren't writing their own tools yet, they're using tools we've built for them. Centralizing tools means: one place to fix a bug, consistent behavior across companies, and simpler access control (a DB row toggle vs. repo permissions). The `company_tools` join table supports both cases: a `tool_id` pointing to a local definition (v1) or a `url` pointing to an HTTP MCP server the customer hosts (v2). Customers that eventually need proprietary tools get the HTTP MCP path without any changes to the central registry.

---

## v2 scope (after v1 ships)

- Edit mode for Skills & Tools — toggle modules on/off, re-launch
- Data section — drag-and-drop files, convert to context modules
- "Generate skill from data" — agent reads a file and suggests a skill `.md`
- Scratch mode at `/` — build an agent from nothing
- HTTP MCP server support — connect customer-hosted data
- GitHub repo sync — pull updated `.md` files from customer repos
- Session history — replay previous sessions

---

## File structure

```
enterprise-assistant/
  app/
    layout.tsx              — root layout
    page.tsx                — scratch studio (/)
    [company]/
      page.tsx              — company-specific studio
    api/
      chat/route.ts
      launch/route.ts
      companies/[slug]/route.ts
      personas/route.ts
      personas/[id]/route.ts
      repos/route.ts
      tools/route.ts
  src/
    components/
      Chat.tsx              — streaming chat component
      CollapsibleSection.tsx
      DataSection.tsx
      SkillsSection.tsx
      ConfigSection.tsx
      CompanyHeader.tsx
    tools/                  — tool definitions (Vercel AI SDK format)
      lims.ts
      qms.ts
      rosetta.ts
      workorder.ts
    lib/
      db.ts                 — Neon client
      compile.ts            — system prompt compiler
      repos.ts              — GitHub repo scanning
  scripts/
    seed.ts                 — seed DB with Findorff preset + demo data
  planv2.md
```

---

## Deployment

```bash
# Vercel project settings
ANTHROPIC_API_KEY=...
DATABASE_URL=...          # Neon connection string
GITHUB_PAT=...            # for private context repos (optional)

# Domain
agent.madstack.net → Vercel project
```

One `vercel deploy`. No other infrastructure for v1.
