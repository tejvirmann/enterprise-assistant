# `agent.madstack.net` – Agent‑as‑a‑Config Studio Plan

## Overview

Goal: build a context‑configurable agent studio under `agent.madstack.net` that lets users:

- Start from scratch (config → data → context → agent).  
- Use pre‑configured “demo‑ready” environments for specific companies (e.g., `agent.madstack.net/findorff`).  
- Interact with an AI assistant that can *generate* context, data, and skills from a natural‑language use case.  

All experiences live in the same agent UI but with different presets, branding, and data sets.

---

## 1. Routes & Subdomains

- `agent.madstack.net`  
  - General agent configurator / “agent from scratch” playground.  
  - Focused on teaching the user how contexts, data, and MCPs work.

- `agent.madstack.net/:company` (e.g., `agent.madstack.net/findorff`)  
  - Company‑specific POC environment.  
  - Comes pre‑loaded with:
    - Company‑branded UI.  
    - Company‑specific MCPs and skills.  
    - Demo data and example use cases.  
  - User can still:
    - Edit configs,  
    - Add their own data,  
    - Generate new context or skills.  

---

## 2. Core UI Sections

Each route has the same tabs, but different defaults:

1. **Chat view**  
   - Always visible, either as:
     - an iframe to `agent-ui.madstack.net`, or  
     - an embedded agent panel talking to your Open WebUI‑compatible API.  
   - The agent is pre‑configured with:
     - System prompt,  
     - Enabled MCPs,  
     - Context from the current workspace.  

2. **Skills & MCPs**  
   - List of “skills” (e.g., “debug SQL”, “parse invoices”, “Findorff WorkOrder agent”).  
   - Each skill maps to:
     - A system‑prompt fragment,  
     - An MCP server definition (OpenAPI / JSON spec).  
   - User can:
     - Enable/disable skills,  
     - Add new MCPs by uploading or generating them.  

3. **Context manager**  
   - List of “contexts” (e.g., “Findorff billing rules”, “example error logs”).  
   - Each context:
     - References one or more data files.  
     - Has a system prompt + instructions for how to use that data.  
   - User can:
     - Create a new context from selected data.  
     - Edit prompts and instructions.  
     - Toggle which contexts are active.  

4. **Data playground**  
   - Large drag‑and‑drop area for:
     - CSV, JSON, PDF, TXT, logs, API docs, etc.  
   - For each file:
     - Preview (parsed text, JSON tree, etc.).  
     - Ability to tag it for later use (e.g., “schema”, “example”, “rules”).  
   - Button: “Generate synthetic data” – ask the agent to create more example data.  

5. **Inspect / Debug view**  
   - For each context / skill / MCP:
     - View raw JSON/YAML.  
   - For each agent run:
     - See what context + MCPs were passed in.  
     - Optionally show a “trace” of tool calls.  

---

## 3. “Agent from Scratch” Flow (General Studio)

This is the default experience on `agent.madstack.net`.

### Step 1 – Use‑case capture chat

- Default view: **Chat view**.  
- Pre‑prompted example question:
  - “Help me build an agent for: [your use case here] (e.g., debugging logs, parsing forms, checking invoices).”  
- The agent can:
  - Ask clarifying questions.  
  - Suggest:
    - What kind of data you need.  
    - What skills/MCPs would help.  
    - What example files would be useful.  

User can switch to **Data playground** or **Context manager** to start building.

### Step 2 – Generate data / context from chat

- In chat, user asks:
  - “Generate example data for my use case.”  
  - “Create a context file for rule‑based invoice validation.”  
- The backend:
  - Uses the agent to generate:
    - JSON/CSV/sample documents.  
    - YAML/JSON context definitions.  
  - Saves them into the current workspace.  
  - Updates the UI (Data playground and Context manager) to show the new files.  

At this point, the user can:
- Accept the generated files,  
- Edit them,  
- Or ask the agent to change them (“make the invoice example more complex”).  

### Step 3 – Configure skills & MCPs

- In **Skills & MCPs** tab:
  - Pre‑loaded “demo” skills for common patterns (logs, forms, rules, etc.).  
- User can:
  - Add new MCPs:
    - Upload a JSON/OpenAPI spec, or  
    - Let the agent write one for them.  
  - Enable/disable skills for the current agent.  

### Step 4 – Build and select contexts

- In **Context manager**:
  - List of contexts, each:
    - References one or more data files.  
    - Has a short description and tags.  
  - User can:
    - Create a new context from a data set.  
    - Edit prompts and instructions.  
    - Toggle which contexts are active.  

### Step 5 – Launch / relaunch agent

- Big button: **“Launch agent”**.  
- On click:
  - Backend:
    - Packages:
      - Active contexts,  
      - Selected skills/MCPs,  
      - Any sample data.  
    - Creates a session (e.g., `POST /sessions`) and returns a session ID.  
  - Frontend:
    - Either:
      - Reloads the iframe to `agent-ui.madstack.net/session/:id`, or  
      - Initializes the embedded agent UI with that session.  
  - The agent now has:
    - The user’s configured context,  
    - The enabled MCPs,  
    - The loaded data.  

---

## 4. Company‑Specific Subdomain (`agent.madstack.net/:company`)

Example: `agent.madstack.net/findorff`

### Step 0 – Branding and defaults

- Company‑specific layout:
  - Colors, logo, header/footer.  
- Pre‑loaded:
  - 1–3 example workspaces:
    - “POC – WorkOrder agent”,  
    - “POC – Invoice reconciler”,  
    - “POC – Field‑report debugger”.  
- Each workspace:
  - Has:
    - System prompt tuned for Findorff,  
    - MCPs pointing to Findorff‑style APIs (mock or real),  
    - Example data files.  

### Step 1 – Default view: already‑launched agent

- When user lands on `agent.madstack.net/findorff`:
  - Default tab: **Agent view**.  
  - The agent iframe is already open and loaded with:
    - Default workspace (e.g., “Findorff WorkOrder POC”).  
- User can start chatting immediately.

### Step 2 – Edit configs while keeping the agent alive

- User can:
  - Switch to **Skills & MCPs**, **Context manager**, or **Data playground**.  
  - Make changes:
    - Add new data files,  
    - Add new MCPs,  
    - Edit prompts and contexts.  
- When the user is happy:
  - Click **“Launch agent”** again.  
  - The agent iframe reloads or re‑initializes with:
    - The updated context set,  
    - New MCPs,  
    - New data.  

### Step 3 – Customer‑only customization

While in their subdomain, the customer can:

- **Drop in their own data**  
  - In **Data playground**, upload:
    - Real CSV, logs, specs, etc.  
  - Let the agent:
    - Generate sample data from it,  
    - Or summarize it into a context.  

- **Generate context / skills from data**  
  - Button: **“Generate context from this data”**.  
  - The agent:
    - Reads the file,  
    - Outputs a suggested context YAML/JSON,  
    - User can accept or edit.  

- **Generate new MCPs**  
  - Button: **“Generate an MCP for this workflow”**.  
  - The agent writes a JSON‑style MCP spec and saves it into the workspace.  
  - User can:
    - Toggle it on/off,  
    - Adjust parameters.  

### Step 4 – Inspect‑everything experience

- In each tab:
  - **“Inspect”** badges for:
    - Contexts → raw JSON/YAML.  
    - MCPs → full spec.  
    - Data files → raw + parsed view.  
- In the chat:
  - Optional toggle: **“Show context trace”**  
    - When the agent makes a call, highlight:
      - Which context entries were used,  
      - Which MCPs were invoked.  

---

## 5. Implementation Outline

### 5.1. Frontend (agent.madstack.net)

- Framework: whatever you use for `madstack.net` (Next.js / React / Vue).  
- Structure:
  - `/` → `agent.madstack.net` (general studio).  
  - `/:company` → company‑specific studio.  
- Components:
  - `ChatView` → iframe or embedded panel to `agent-ui.madstack.net`.  
  - `DataPlayground` → drag‑and‑drop + file list.  
  - `ContextManager` → table‑like list of contexts.  
  - `SkillsMCPs` → list of skills and MCPs.  
  - `InspectPanel` → code‑like view of JSON/YAML.  

### 5.2. Backend (configs & sessions)

- Service: `api.agent.madstack.net`  
  - Endpoints:
    - `POST /workspaces` – create new workspace.  
    - `GET /workspaces/:id` – load workspace.  
    - `POST /workspaces/:id/data` – upload or generate data.  
    - `POST /workspaces/:id/contexts` – create context from data.  
    - `POST /workspaces/:id/skills` – create or update skills/MCPs.  
    - `POST /sessions` – create a session with current config → returns `session_id`.  

### 5.3. Agent UI (Open WebUI–compatible)

- Deploy:
  - `agent-ui.madstack.net` – Open WebUI or custom agent UI.  
  - Or use Open WebUI’s API (`/api/chat/completions`) and build your own chat pane.  
- Use features:
  - MCP integration (external tools / MCP servers). [web:33][web:30]  
  - External API wiring so your backend can:
    - Configure tools,  
    - Supply context,  
    - Inject data.  

### 5.4. User‑visible “how it works” zone

- Optional page: `/explain` or a toggle in the UI:
  - “How this agent works”:
    - Diagram: user → data → context → MCPs → agent → answer.  
  - “Inspect” mode that shows:
    - What MCPs are enabled,  
    - What data is loaded,  
    - How the agent uses it.  

---

## 6. Next Steps for You

- Decide:
  - Are you self‑hosting Open WebUI or using a SaaS API?  
  - What stack is your existing `madstack.net` on?  
- Then you can:
  - Start by wiring:
    - `agent.madstack.net` → data + context manager UI.  
    - `agent-ui.madstack.net` → Open WebUI or your own agent UI.  
  - Then add the company‑specific routes and templates.  

Copy this `.md` into your repo (e.g., `docs/agent-studio-plan.md`) and start from there.