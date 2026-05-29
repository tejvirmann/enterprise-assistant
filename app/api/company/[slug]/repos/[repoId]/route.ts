import { sql } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; repoId: string }> }) {
  const { repoId } = await params
  const modules = await sql`
    SELECT * FROM repo_modules WHERE repo_id = ${repoId} ORDER BY type, name
  `
  return Response.json(modules)
}
