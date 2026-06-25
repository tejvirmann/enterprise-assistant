import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rows = await sql`SELECT kind, ref_id FROM company_preset_exclusions WHERE company_id = ${slug}`
  return Response.json(rows)
}

// Turn off a preset-provided tool/mcp_server/module for this company
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { kind, ref_id, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!['tool', 'mcp_server', 'module'].includes(kind)) {
    return Response.json({ error: 'invalid kind' }, { status: 400 })
  }

  await sql`
    INSERT INTO company_preset_exclusions (company_id, kind, ref_id) VALUES (${slug}, ${kind}, ${String(ref_id)})
    ON CONFLICT DO NOTHING
  `
  return Response.json({ ok: true })
}

// Bring a preset-provided item back (remove the exclusion)
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { kind, ref_id, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  await sql`
    DELETE FROM company_preset_exclusions
    WHERE company_id = ${slug} AND kind = ${kind} AND ref_id = ${String(ref_id)}
  `
  return Response.json({ ok: true })
}
