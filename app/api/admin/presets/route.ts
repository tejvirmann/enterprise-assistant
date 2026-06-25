import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'

export async function GET(req: Request) {
  const adminKey = new URL(req.url).searchParams.get('adminKey')
  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  const presets = await sql`SELECT * FROM presets ORDER BY name`
  return Response.json(presets)
}

export async function POST(req: Request) {
  const { name, description, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  await sql`INSERT INTO presets (id, name, description) VALUES (${id}, ${name.trim()}, ${description ?? null})`
  return Response.json({ id })
}
