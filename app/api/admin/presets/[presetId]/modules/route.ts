import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const modules = await sql`
    SELECT * FROM preset_modules WHERE preset_id = ${presetId} ORDER BY type, name
  `
  return Response.json(modules)
}

export async function POST(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { name, type, description, content, tokens, example_prompts, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const rows = await sql`
    INSERT INTO preset_modules (preset_id, type, name, description, content, tokens, example_prompts)
    VALUES (${presetId}, ${type ?? 'skill'}, ${name.trim()}, ${description ?? null}, ${content ?? null}, ${tokens ?? null}, ${example_prompts ?? []})
    RETURNING id
  `
  return Response.json({ id: rows[0].id })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { moduleId, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`DELETE FROM preset_modules WHERE id = ${moduleId} AND preset_id = ${presetId}`
  return Response.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { moduleId, name, description, content, tokens, example_prompts, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`
    UPDATE preset_modules SET
      name             = COALESCE(${name ?? null}, name),
      description      = COALESCE(${description ?? null}, description),
      content          = ${content ?? null},
      tokens           = COALESCE(${tokens ?? null}, tokens),
      example_prompts  = COALESCE(${example_prompts ?? null}, example_prompts)
    WHERE id = ${moduleId} AND preset_id = ${presetId}
  `
  return Response.json({ ok: true })
}
