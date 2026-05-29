import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'
import type { McpServerTool } from '@/lib/types'

async function fetchMcpTools(url: string): Promise<McpServerTool[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`MCP server returned ${res.status}`)
  const data = await res.json() as { result?: { tools?: McpServerTool[] } }
  return data.result?.tools ?? []
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rows = await sql`
    SELECT * FROM company_mcp_servers WHERE company_id = ${slug} ORDER BY created_at
  `
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { name, url, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })
  if (!url?.trim()) return Response.json({ error: 'url required' }, { status: 400 })

  let tools: McpServerTool[] = []
  let scanError: string | null = null
  try {
    tools = await fetchMcpTools(url.trim())
  } catch (e) {
    scanError = e instanceof Error ? e.message : 'Scan failed'
  }

  const rows = await sql`
    INSERT INTO company_mcp_servers (company_id, name, url, tools, last_scanned)
    VALUES (${slug}, ${name.trim()}, ${url.trim()}, ${JSON.stringify(tools)}::jsonb, ${tools.length > 0 ? new Date().toISOString() : null})
    RETURNING id
  `
  return Response.json({ id: rows[0].id, toolCount: tools.length, scanError })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { serverId, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  await sql`DELETE FROM company_mcp_servers WHERE id = ${serverId} AND company_id = ${slug}`
  return Response.json({ ok: true })
}
