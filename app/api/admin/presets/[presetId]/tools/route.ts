import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const rows = await sql`SELECT tool_id FROM preset_tools WHERE preset_id = ${presetId} ORDER BY tool_id`
  return Response.json(rows)
}

export async function POST(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { toolId, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`
    INSERT INTO preset_tools (preset_id, tool_id) VALUES (${presetId}, ${toolId})
    ON CONFLICT DO NOTHING
  `
  return Response.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { toolId, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`DELETE FROM preset_tools WHERE preset_id = ${presetId} AND tool_id = ${toolId}`
  return Response.json({ ok: true })
}
