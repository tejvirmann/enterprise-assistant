import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'
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

// POST — rescan tools for this preset's MCP server
export async function POST(req: Request, { params }: { params: Promise<{ presetId: string; serverId: string }> }) {
  const { presetId, serverId } = await params
  const { adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  const rows = await sql`SELECT url FROM preset_mcp_servers WHERE id = ${serverId} AND preset_id = ${presetId}`
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const tools = await fetchMcpTools(rows[0].url as string)
    await sql`
      UPDATE preset_mcp_servers
      SET tools = ${JSON.stringify(tools)}::jsonb, last_scanned = NOW()
      WHERE id = ${serverId} AND preset_id = ${presetId}
    `
    return Response.json({ toolCount: tools.length })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Scan failed' }, { status: 502 })
  }
}
