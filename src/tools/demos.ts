// Tools for the /demo guide agent: what demos exist, and what each one is made of (skills, blueprints,
// tools, MCP servers). Reads the live configuration from the database, so it never goes stale.

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { AGENT_BASE_URL, DEMO_DIRECTORY, EXTERNAL_DEMOS } from '@/lib/demos'
import { limsTools } from './lims'
import { qmsTools } from './qms'
import { rosettaTools } from './rosetta'
import { projectTools } from './projects'
import { portfolioTools } from './portfolio'

// Tool id -> description, built from the tool modules directly (importing ./index would be circular).
const DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries({ ...limsTools, ...qmsTools, ...rosettaTools, ...projectTools, ...portfolioTools }).map(
    ([id, t]) => [id, String((t as { description?: string }).description ?? '').split(/(?<=\.)\s/)[0]],
  ),
)

const SYSTEM_LABELS: Record<string, string> = {
  lims: 'LIMS (lab information)', qms: 'QMS (quality management)', rosetta: 'Rosetta (term and unit normalization)',
  proj: 'Project Controls', safety: 'Jobsite Safety', port: 'Portfolio', risk: 'Risk', ips: 'Compliance (IPS)', demo: 'Demo Guide',
}

export const demoTools = {
  demo_list_demos: tool({
    description:
      'List every available demo with its name, industry, one-line description, link, and counts of skills, blueprints, tools and MCP servers. Call this first for any question about what demos exist or which one fits an industry.',
    parameters: z.object({}),
    execute: async () => {
      const slugs = DEMO_DIRECTORY.map((d) => d.slug)
      const companies = await sql`SELECT id, name, default_persona_id FROM companies WHERE id = ANY(${slugs})`
      const mods = await sql`SELECT p.company_id, m.type, count(*) AS n FROM persona_modules m JOIN personas p ON p.id = m.persona_id WHERE m.enabled AND p.company_id = ANY(${slugs}) GROUP BY 1, 2`
      const tools = await sql`SELECT company_id, count(*) AS n FROM company_tools WHERE enabled AND company_id = ANY(${slugs}) GROUP BY 1`
      const mcps = await sql`SELECT company_id, count(*) AS n FROM company_mcp_servers WHERE enabled AND company_id = ANY(${slugs}) GROUP BY 1`
      const n = (rows: Record<string, unknown>[], id: string, type?: string) =>
        Number(rows.find((r) => r.company_id === id && (type === undefined || r.type === type))?.n ?? 0)

      const hosted = DEMO_DIRECTORY.flatMap((d) => {
        const c = companies.find((x) => x.id === d.slug)
        if (!c) return []
        return [{
          slug: d.slug, name: c.name, industry: d.industry, description: d.blurb, url: `${AGENT_BASE_URL}/${d.slug}`,
          skills: n(mods, d.slug, 'skill'), blueprints: n(mods, d.slug, 'blueprint'), tools: n(tools, d.slug), mcp_servers: n(mcps, d.slug),
          try_asking: d.tryAsking,
        }]
      })
      const external = EXTERNAL_DEMOS.map((e) => ({
        slug: e.slug, name: e.name, industry: e.industry, description: e.blurb, url: e.url, mcp_endpoint: e.mcpUrl, tools: e.tools.length, hosted_elsewhere: true,
      }))
      return JSON.stringify({ demos: [...hosted, ...external] })
    },
  }),

  demo_get_demo: tool({
    description:
      'Full detail on one demo: its skills and blueprints (with descriptions), its tools grouped by system with what each does, any connected MCP servers, a link, and a sample question. slug: one of the slugs from demo_list_demos (e.g. "lattice", "findorff", "lancaster-investments", "retinal-image-quality").',
    parameters: z.object({ slug: z.string() }),
    execute: async ({ slug }) => {
      const ext = EXTERNAL_DEMOS.find((e) => e.slug === slug)
      if (ext) return JSON.stringify({ name: ext.name, industry: ext.industry, description: ext.blurb, url: ext.url, mcp_endpoint: ext.mcpUrl, tools: ext.tools, how_to_use: 'Connect the MCP endpoint from Claude Desktop, OpenCode or any MCP client, or open the link in a browser.' })

      const entry = DEMO_DIRECTORY.find((d) => d.slug === slug)
      if (!entry) return JSON.stringify({ error: `Unknown demo "${slug}". Call demo_list_demos for the available ones.` })

      const c = (await sql`SELECT id, name, description, default_persona_id FROM companies WHERE id = ${slug}`)[0]
      if (!c) return JSON.stringify({ error: `Demo "${slug}" is not configured.` })
      const modules = await sql`SELECT type, name, description, tokens FROM persona_modules WHERE persona_id = ${c.default_persona_id} AND enabled ORDER BY type, name`
      const toolRows = await sql`SELECT tool_id FROM company_tools WHERE company_id = ${slug} AND enabled ORDER BY tool_id`
      const mcps = await sql`SELECT name, url, jsonb_array_length(coalesce(tools, '[]'::jsonb)) AS tool_count FROM company_mcp_servers WHERE company_id = ${slug} AND enabled`

      const groups: Record<string, { tool: string; does: string }[]> = {}
      for (const { tool_id } of toolRows as { tool_id: string }[]) {
        const prefix = tool_id.split('_')[0]
        ;(groups[SYSTEM_LABELS[prefix] ?? prefix] ??= []).push({ tool: tool_id, does: DESCRIPTIONS[tool_id] ?? '' })
      }
      return JSON.stringify({
        name: c.name, industry: entry.industry, description: c.description, url: `${AGENT_BASE_URL}/${slug}`,
        marketplace_url: `${AGENT_BASE_URL}/${slug}/marketplace`,
        skills: modules.filter((m) => m.type === 'skill'), blueprints: modules.filter((m) => m.type === 'blueprint'),
        tools_by_system: groups, mcp_servers: mcps, try_asking: entry.tryAsking,
      })
    },
  }),
}
