# Enterprise Assistant

A context-configurable AI agent studio for enterprise demos and POCs.

Each company gets a pre-loaded environment at `agent.madstack.net/[company]` — branded, pre-configured, and ready to chat on arrival. The same app serves a blank scratch environment at the root for building agents from nothing.

Built as the web successor to [lattice-poc](../lattice-poc) — same mental model, native web stack, no Docker required.

---

## How it works

```
agent.madstack.net/findorff

  ┌──────────────────────────────────────────────────┐
  │  [Findorff]                                      │
  │                                                  │
  │  ▼ Data          (files loaded into context)     │
  │  ▼ Skills & Tools (what the agent can do)        │
  │  ▼ Config         (persona + system prompt)      │
  │  [  Launch Agent  ]                              │
  │  ────────────────────────────────────────────    │
  │  Chat  (streaming, always visible)               │
  └──────────────────────────────────────────────────┘
```

One page per company. Collapsible sections build up the agent's context. Chat is always live at the bottom. On company routes, sections arrive pre-filled and collapsed — the agent is ready to use immediately.

The system prompt is compiled from active persona modules (Markdown skill/blueprint files, same as lattice-poc) and injected at session launch. MCP tools are registered per company and passed to the model as tool definitions.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + API | Next.js 15 (App Router), Vercel |
| Chat | Vercel AI SDK + OpenRouter (default) or Ollama (local) |
| Database | Neon PostgreSQL (serverless, Vercel integration) |
| Context content | GitHub repos — `skills/*.md`, `blueprints/*.md` |
| Styling | Tailwind CSS |

No Docker. No separate backend. Three external services: Vercel, Neon, Anthropic.

---

## Architecture

```
agent.madstack.net (Vercel)
  /                     — scratch studio
  /[company]            — company-specific POC

Next.js API routes:
  /api/chat             — streaming chat (Vercel AI SDK)
  /api/launch           — compile system prompt → create session
  /api/companies/[slug] — load company branding + default persona
  /api/personas/*       — persona + module CRUD
  /api/repos/*          — GitHub context repo management
  /api/tools            — tools available to a company

Neon PostgreSQL:
  companies             — branding, default persona, color
  context_repos         — registered GitHub repos
  repo_modules          — .md files scanned from repos
  personas              — named bundles of modules
  persona_modules       — module ↔ persona assignments
  company_tools         — which tools each company can use
  sessions              — launched session snapshots

Tool registry (src/tools/):
  All tools defined centrally in TypeScript.
  company_tools table controls per-company access.
  v2: HTTP MCP servers for customer-hosted data.
```

Full architectural decisions are documented in [planv2.md](planv2.md).

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) database (free tier)
- An [OpenRouter](https://openrouter.ai) API key, or [Ollama](https://ollama.ai) running locally

### Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env.local

# Push DB schema
npm run db:push

# Seed with demo data (Findorff preset)
npm run db:seed

# Run locally
npm run dev
```

Open `http://localhost:3000/findorff`.

### Environment variables

```env
# Pick one provider
PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5

# or local Ollama
# PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=qwen3:8b

DATABASE_URL=postgresql://...     # Neon connection string (auto-injected by Vercel integration)
GITHUB_PAT=ghp_...                # Optional — for private context repos
```

---

## Adding a company

1. Add a row to `companies` with a slug, name, logo, and brand color.
2. Create a `personas` row with the default context for that company.
3. Add `persona_modules` pointing to the skill/blueprint files to load.
4. Add `company_tools` rows for the tools they have access to.
5. Visit `agent.madstack.net/[slug]`.

Or run: `npm run seed -- --company [slug]` with a seed config file.

---

## Adding a skill or blueprint

Skills and blueprints are Markdown files with frontmatter, identical to the lattice-poc format:

```markdown
---
name: LIMS Analysis
description: Querying and interpreting lab data
type: skill
tokens: ~400
---

Instructions for the model go here...
```

Add them to a GitHub repo, register the repo via `/api/repos`, and they appear as available modules in the config panel.

---

## Relation to lattice-poc

| lattice-poc | enterprise-assistant |
|---|---|
| Open WebUI (Docker) | Chat built into the Next.js app |
| Lattice Manager (FastAPI) | Next.js API routes |
| MCPO + stdio subprocesses | Inline TypeScript tools (v1) / HTTP MCP (v2) |
| SQLite `context.db` | Neon PostgreSQL |
| `registry/` local files | GitHub repos + DB |
| `generate.py` + `opencode.jsonc` | `compile.ts` → session system prompt |
| `./lattice web` | `vercel deploy` |

The context model (personas → modules → compiled system prompt) is unchanged. The deployment model is entirely different.

---

## Deployment

```bash
vercel deploy
```

Set `ANTHROPIC_API_KEY`, `DATABASE_URL`, and point the domain to `agent.madstack.net`.
