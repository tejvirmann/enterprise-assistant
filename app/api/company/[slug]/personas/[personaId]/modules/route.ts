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
  const body = await req.json()
  const { adminKey } = body

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  // Adding from a repo: look up content from repo_modules
  if (body.repo_id && body.path) {
    const { repo_id, path } = body
    const existing = await sql`
      SELECT * FROM persona_modules WHERE persona_id = ${personaId} AND repo_id = ${repo_id} AND path = ${path}
    `
    if (existing.length) return Response.json({ id: existing[0].id, exists: true })

    const rmRows = await sql`SELECT * FROM repo_modules WHERE repo_id = ${repo_id} AND path = ${path}`
    if (!rmRows.length) return Response.json({ error: 'module not found' }, { status: 404 })
    const rm = rmRows[0]

    const rows = await sql`
      INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content)
      VALUES (${personaId}, ${repo_id}, ${path}, ${rm.type}, ${rm.name}, ${rm.description ?? null},
              ${rm.tokens ?? null}, true, ${rm.content ?? null})
      RETURNING id
    `
    return Response.json({ id: rows[0].id })
  }

  // Manual module creation
  const { name, type, description, content, tokens } = body
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO persona_modules (persona_id, type, name, description, content, tokens, enabled)
    VALUES (${personaId}, ${type ?? 'skill'}, ${name.trim()}, ${description ?? null}, ${content ?? null}, ${tokens ?? null}, true)
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

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; personaId: string }> }) {
  const { slug, personaId } = await params
  const { moduleId, name, description, content, tokens, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  await sql`
    UPDATE persona_modules SET
      name        = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      content     = ${content ?? null},
      tokens      = COALESCE(${tokens ?? null}, tokens)
    WHERE id = ${moduleId} AND persona_id = ${personaId}
  `
  return Response.json({ ok: true })
}
