import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const repos = await sql`
    SELECT r.* FROM repos r
    JOIN company_repos cr ON cr.repo_id = r.id
    WHERE cr.company_id = ${slug}
    ORDER BY r.name
  `
  return Response.json(repos)
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { id, name, description, repo_url, owner, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const repoId = id ?? `${slug}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`

  await sql`
    INSERT INTO repos (id, name, description, repo_url, owner, scope, verified, module_count)
    VALUES (${repoId}, ${name.trim()}, ${description ?? null}, ${repo_url ?? null}, ${owner ?? null}, 'private', false, 0)
    ON CONFLICT (id) DO NOTHING
  `

  await sql`
    INSERT INTO company_repos (company_id, repo_id) VALUES (${slug}, ${repoId})
    ON CONFLICT DO NOTHING
  `

  return Response.json({ id: repoId })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { repoId, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  await sql`DELETE FROM company_repos WHERE company_id = ${slug} AND repo_id = ${repoId}`
  return Response.json({ ok: true })
}
