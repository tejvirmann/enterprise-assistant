import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { slug, personaId } = await params
  const body = await req.json()
  const { adminKey, set_default, name, description } = body

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (set_default) {
    await sql`UPDATE companies SET default_persona_id = ${personaId} WHERE id = ${slug}`
  }
  if (name !== undefined) {
    await sql`
      UPDATE personas SET name = ${name.trim()}, description = ${description ?? null}
      WHERE id = ${personaId} AND company_id = ${slug}
    `
  }
  return Response.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { slug, personaId } = await params
  const { adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  const rows = await sql`SELECT default_persona_id FROM companies WHERE id = ${slug}`
  if (rows[0]?.default_persona_id === personaId) {
    return Response.json({ error: 'Cannot delete the default persona' }, { status: 400 })
  }

  await sql`DELETE FROM personas WHERE id = ${personaId} AND company_id = ${slug}`
  return Response.json({ ok: true })
}
