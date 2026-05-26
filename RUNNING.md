# Running Enterprise Assistant

---

## Run locally

### Step 1 — Install
```bash
npm install
```

### Step 2 — Environment
```bash
cp .env.example .env.local
```

Fill in two values:
```env
OPENROUTER_API_KEY=sk-or-...    # from openrouter.ai
DATABASE_URL=postgresql://...   # from neon.tech (free)
```

### Step 3 — Seed the database
Creates all tables and inserts the demo biologics data.
```bash
npm run db:seed
```

### Step 4 — Run
```bash
npm run dev
```

Open **http://localhost:3000/findorff**

That's it. No Docker, no Open WebUI, no other services.

---

## Optionally: run with Open WebUI

If you want to use Open WebUI as the inference backend instead of OpenRouter:

```bash
# Start Open WebUI (one-time Docker pull on first run)
docker compose up -d

# Switch provider in .env.local
PROVIDER=openwebui
OPENWEBUI_URL=http://localhost:4000
OPENWEBUI_MODEL=deepseek/deepseek-v4-flash  # match a model loaded in Open WebUI
# (no API key needed — WEBUI_AUTH=False)

npm run dev
```

Open WebUI handles inference and any MCPs registered there.
Your app compiles and injects the system prompt per request.

---

## Deploy to Vercel

```bash
npm i -g vercel   # if not installed
vercel deploy
```

In the Vercel dashboard, set environment variables:
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `PROVIDER=openrouter`
- `DATABASE_URL` — easiest: add the Neon integration (Settings → Integrations → Neon) and it injects this automatically

Set domain: `agent.madstack.net`

Then seed the production database once:
```bash
DATABASE_URL=<your-neon-url> npm run db:seed
```

Done. `agent.madstack.net/findorff` is live.

---

## Deploy Open WebUI (optional, for Railway)

If you want Open WebUI in production:

1. New project on [railway.app](https://railway.app)
2. Deploy from Docker image: `ghcr.io/open-webui/open-webui:main`
3. Set env vars: `WEBUI_AUTH=False`, `OPENAI_API_BASE_URL=https://openrouter.ai/api/v1`, `OPENAI_API_KEY=sk-or-...`
4. Expose port 8080
5. In your Vercel env vars, set `PROVIDER=openwebui` and `OPENWEBUI_URL=https://your-app.railway.app`

Railway has a free tier ($5 credit/month, enough for a demo instance).

---

## Try these prompts

- `What MCP tools and context do I have?`
- `Show me all open critical deviations and their CAPAs.`
- `Is the most recent Nexivab batch ready for release?`
- `Compare HPLC Purity results for XB-441 across all batches.`
- `Investigate deviation DEV-2025-003 — what LIMS results were affected?`
