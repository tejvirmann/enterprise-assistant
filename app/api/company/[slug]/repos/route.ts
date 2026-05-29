import { sql } from '@/lib/db'
import { validateAdminKey, requireKey } from '@/lib/auth'

interface ScannedModule {
  path: string; name: string; type: string; content: string; description: string | null; tokens: number
}

async function scanGitHub(repoUrl: string): Promise<ScannedModule[]> {
  const match = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s.#?]+)/)
  if (!match) return []
  const [, owner, repo] = match

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'enterprise-assistant/1.0',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  )
  if (!treeRes.ok) return []
  const tree = await treeRes.json()

  const mdFiles: { path: string }[] = ((tree.tree as Array<{ type: string; path: string }>) ?? [])
    .filter((f) =>
      f.type === 'blob' &&
      f.path.endsWith('.md') &&
      !/^(readme|changelog|license|contributing)/i.test(f.path.split('/').pop() ?? '')
    )
    .slice(0, 15)

  const results: ScannedModule[] = []
  for (const file of mdFiles) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
        { headers }
      )
      if (!res.ok) continue
      const data = (await res.json()) as { content?: string }
      if (!data.content) continue
      const content = Buffer.from(data.content, 'base64').toString('utf-8')

      const pathLower = file.path.toLowerCase()
      let type = 'context'
      if (pathLower.includes('skill')) type = 'skill'
      else if (pathLower.includes('blueprint')) type = 'blueprint'
      else if (pathLower.includes('command')) type = 'command'
      else if (pathLower.includes('agent')) type = 'agent'

      const basename = file.path.split('/').pop()!.replace(/\.md$/i, '')
      const name = basename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

      results.push({ path: file.path, name, type, content, tokens: Math.round(content.length / 4), description: null })
    } catch { /* skip file */ }
  }
  return results
}

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
  const { name, description, repo_url, adminKey } = await req.json()

  const valid = await validateAdminKey(slug, adminKey)
  const denied = requireKey(valid)
  if (denied) return denied

  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const repoId = `${slug}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`

  // Scan GitHub if URL provided
  let scanned: ScannedModule[] = []
  if (repo_url?.includes('github.com')) {
    try { scanned = await scanGitHub(repo_url) } catch { /* non-fatal */ }
  }

  await sql`
    INSERT INTO repos (id, name, description, repo_url, owner, scope, verified, module_count)
    VALUES (${repoId}, ${name.trim()}, ${description ?? null}, ${repo_url ?? null}, ${slug}, 'private', false, ${scanned.length})
  `
  await sql`INSERT INTO company_repos (company_id, repo_id) VALUES (${slug}, ${repoId}) ON CONFLICT DO NOTHING`

  for (const m of scanned) {
    await sql`
      INSERT INTO repo_modules (repo_id, path, type, name, description, tokens, content)
      VALUES (${repoId}, ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${m.content})
    `
  }

  return Response.json({ id: repoId, moduleCount: scanned.length })
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
