import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const personas = await sql`
    SELECT p.*, COUNT(pm.id)::int AS module_count
    FROM personas p
    LEFT JOIN persona_modules pm ON pm.persona_id = p.id
    WHERE p.company_id = ${slug}
    GROUP BY p.id
    ORDER BY p.created_at
  `
  return Response.json(personas)
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { name, description, scope, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const id = `${slug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
  await sql`
    INSERT INTO personas (id, company_id, name, description, scope)
    VALUES (${id}, ${slug}, ${name.trim()}, ${description ?? ''}, ${scope ?? 'private'})
  `
  return Response.json({ id })
}
