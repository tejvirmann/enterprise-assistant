# Company Asset Map

Every asset that changes when you swap from Findorff → Axios Biosciences (or any other company).

---

## Assets stored in the database

### 1. `companies` row — UI wrapper + base instruction

| Field | Findorff value | What it controls |
|---|---|---|
| `id` | `findorff` | URL slug → `agent.madstack.net/findorff` |
| `name` | `Findorff` | Header title, compiled prompt header `# Findorff Agent` |
| `description` | `Biologics manufacturing…` | Header subtitle |
| `color` | `#2563eb` | CSS `--brand` var → header accent, send button, `>` prompt cursor, relaunch button |
| `logo_url` | _(null)_ | Logo in header (not yet wired in UI) |
| `brand_config` | _(null, JSONB)_ | Secondary color, font, tagline, chat welcome message |
| `base_context` | See below ↓ | Always-on system prompt preamble (injected before skills) |
| `default_persona_id` | `findorff-default` | Which persona loads by default |

**`base_context` content for Findorff** (in `scripts/seed.ts`):
```
You are an enterprise AI assistant with access to MCP tools that query data systems directly.
Never guess at data values — always query the tools.
...
```
This is the **agent instruction file** — the equivalent of `context.md` in lattice-poc.

---

### 2. `personas` row — agent role

| Field | Findorff value |
|---|---|
| `id` | `findorff-default` |
| `name` | `QC Analyst` |
| `description` | `Quality control analyst with LIMS and QMS access` |

Shown in the ConfigPanel header. Can be extended to multiple personas per company (e.g. a separate `Regulatory Affairs` persona).

---

### 3. `persona_modules` rows — skills / blueprints (context injected into prompt)

These are the **skill instruction files** — markdown documents that tell the agent how to behave in a specific domain. Each module's `content` field gets appended to the compiled system prompt.

| `name` | `type` | `content` summary |
|---|---|---|
| LIMS Analysis | skill | How to query samples, assays, OOS results; format tables; flag failures |
| QMS Investigation | skill | How to query deviations, CAPAs, batch release; severity hierarchy |

For Axios Biosciences you'd replace these with e.g.:
- `Cell Line Development` (skill)
- `Upstream Process` (blueprint)
- `Regulatory Submission Tracker` (skill)

---

### 4. `company_tools` rows — MCP tools enabled

Controls which tools from the TypeScript registry are available to the agent. Findorff has 19 tools across 3 servers:

| Server | Tools |
|---|---|
| LIMS | `lims_list_compounds`, `lims_search_samples`, `lims_get_assay_results`, `lims_get_oos_results`, `lims_get_instrument_status`, `lims_compare_compound_results` |
| QMS | `qms_list_products`, `qms_get_batch`, `qms_list_batches`, `qms_get_deviations`, `qms_get_open_capas`, `qms_get_specifications`, `qms_check_batch_release`, `qms_get_audit_findings` |
| Rosetta | `rosetta_normalize_term`, `rosetta_convert_units`, `rosetta_resolve_compound`, `rosetta_list_term_mappings`, `rosetta_standardize_status` |

For Axios you'd enable a different subset — or add new tool servers entirely.

---

## Assets in code (shared across all companies)

| File | What it does |
|---|---|
| `src/lib/compile.ts` | Assembles the system prompt: header → `base_context` → skill module contents |
| `src/tools/lims.ts` | LIMS tool implementations (SQL queries against Neon) |
| `src/tools/qms.ts` | QMS tool implementations |
| `src/tools/rosetta.ts` | Rosetta tool implementations |
| `src/components/CompanyStudio.tsx` | Layout shell — reads `company.color` for `--brand` CSS var |
| `src/components/ConfigPanel.tsx` | Left panel — reads persona name, modules, tools from DB |

These files are **shared** — changing them affects all companies. Per-company customization lives entirely in the DB.

---

## What the compiled system prompt looks like

When a chat message is sent for Findorff, `compile.ts` produces:

```
# Findorff Agent

## Context Loaded
### Skills
- **LIMS Analysis**  (~400 tokens)
- **QMS Investigation**  (~450 tokens)

## MCP Tools Available
- **lims_search_samples**
- **lims_get_assay_results**
- ... (19 total)

---

You are an enterprise AI assistant with access to MCP tools...
[base_context content]

---

When asked about analytical results, samples, or assay data:
[LIMS skill content]

---

When asked about deviations, batch status, or quality events:
[QMS skill content]
```

---

## Adding Axios Biosciences

To swap in a new company, you need **one seed block** in `scripts/seed.ts` (or direct DB inserts):

```typescript
// 1. Company row
INSERT INTO companies (id, name, color, base_context) VALUES
('axios', 'Axios Biosciences', '#7c3aed', '...')

// 2. Persona
INSERT INTO personas (id, company_id, name) VALUES
('axios-default', 'axios', 'Process Development Scientist')

// 3. Skill modules
INSERT INTO persona_modules (persona_id, type, name, content) VALUES
('axios-default', 'skill', 'Cell Line Development', '...')

// 4. Tools (subset of what's available)
INSERT INTO company_tools (company_id, tool_id, enabled) VALUES
('axios', 'lims_search_samples', true), ...
```

Then visit `agent.madstack.net/axios`.

---

## "Go back" / edit MCPs and context in the demo

**Current state (v1):** The Session panel lets you toggle tools and modules on/off. Changes are **session-only** — they affect the current chat but don't persist.

**Not yet built (Phase 2):**
- A **Marketplace tab** (`/[company]/marketplace`) to browse and add skill repos
- A **Personas tab** (`/[company]/personas`) to edit the persona, add/remove modules, create new skills from scratch
- **Persistence**: changes save to DB only when a valid `?key=xxx` admin key is in the URL

This matches the lattice-poc flow exactly (Marketplace → My Personas → Session), just web-native.
