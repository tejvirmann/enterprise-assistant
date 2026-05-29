import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { personaId } = await params
  const modules = await sql`
    SELECT * FROM persona_modules WHERE persona_id = ${personaId} ORDER BY type, name
  `
  return Response.json(modules)
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { slug, personaId } = await params
  const { name, type, description, content, tokens, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO persona_modules (persona_id, type, name, description, content, tokens, enabled)
    VALUES (${personaId}, ${type ?? 'skill'}, ${name.trim()}, ${description ?? ''}, ${content ?? ''}, ${tokens ?? null}, true)
    RETURNING id
  `
  return Response.json({ id: rows[0].id })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { slug, personaId } = await params
  const { moduleId, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  await sql`
    DELETE FROM persona_modules WHERE id = ${moduleId} AND persona_id = ${personaId}
  `
  return Response.json({ ok: true })
}
