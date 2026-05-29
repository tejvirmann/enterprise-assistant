import { sql } from '@/lib/db'
import { ALL_TOOLS } from '@/tools/index'
import { validateAdminKey, requireKey } from '@/lib/auth'

// Group tools by server prefix (lims, qms, rosetta, …)
function groupTools() {
  const groups: Record<string, { toolId: string; description: string }[]> = {}
  for (const [toolId, tool] of Object.entries(ALL_TOOLS)) {
    const prefix = toolId.split('_')[0]
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push({ toolId, description: (tool as { description?: string }).description ?? '' })
  }
  return groups
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const enabledRows = await sql`
    SELECT tool_id FROM company_tools WHERE company_id = ${slug} AND enabled = true
  `
  const enabled = new Set(enabledRows.map((r) => r.tool_id as string))
  const groups = groupTools()
  const result = Object.entries(groups).map(([prefix, tools]) => ({
    prefix,
    tools: tools.map((t) => ({ ...t, enabled: enabled.has(t.toolId) })),
    allEnabled: tools.every((t) => enabled.has(t.toolId)),
  }))
  return Response.json(result)
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { toolId, enabled, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (enabled) {
    await sql`
      INSERT INTO company_tools (company_id, tool_id, enabled)
      VALUES (${slug}, ${toolId}, true)
      ON CONFLICT DO NOTHING
    `
    await sql`
      UPDATE company_tools SET enabled = true
      WHERE company_id = ${slug} AND tool_id = ${toolId}
    `
  } else {
    await sql`
      UPDATE company_tools SET enabled = false
      WHERE company_id = ${slug} AND tool_id = ${toolId}
    `
  }
  return Response.json({ ok: true })
}
