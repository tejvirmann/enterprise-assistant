import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ALL_TOOLS } from '@/tools/index'
import { MarketplaceClient } from '@/components/MarketplaceClient'
import type { Company, Persona, Repo, RepoModule, McpServer } from '@/lib/types'

interface Props {
  params: Promise<{ company: string }>
  searchParams: Promise<{ key?: string }>
}

function buildToolGroups() {
  const groups: Record<string, { toolId: string; description: string }[]> = {}
  for (const [toolId, tool] of Object.entries(ALL_TOOLS)) {
    const prefix = toolId.split('_')[0]
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push({ toolId, description: (tool as { description?: string }).description ?? '' })
  }
  return groups
}

export default async function MarketplacePage({ params, searchParams }: Props) {
  const { company: slug } = await params
  const { key } = await searchParams

  const companies = await sql`SELECT * FROM companies WHERE id = ${slug}`
  if (!companies.length) notFound()
  const company = companies[0] as Company & { admin_key?: string }

  const isAdmin = !!key && key === company.admin_key

  const enabledRows = await sql`
    SELECT tool_id FROM company_tools WHERE company_id = ${slug} AND enabled = true
  `
  const enabledTools = enabledRows.map((r) => r.tool_id as string)

  const repos = await sql`
    SELECT r.* FROM repos r
    JOIN company_repos cr ON cr.repo_id = r.id
    WHERE cr.company_id = ${slug}
    ORDER BY r.name
  ` as Repo[]

  const repoModules = repos.length ? await sql`
    SELECT * FROM repo_modules
    WHERE repo_id = ANY(${repos.map((r) => r.id)})
    ORDER BY repo_id, type, name
  ` as RepoModule[] : []

  const personas = await sql`
    SELECT id, name FROM personas WHERE company_id = ${slug} ORDER BY created_at
  ` as Pick<Persona, 'id' | 'name'>[]

  const mcpServers = await sql`
    SELECT * FROM company_mcp_servers WHERE company_id = ${slug} ORDER BY created_at
  ` as McpServer[]

  const toolGroups = buildToolGroups()

  return (
    <MarketplaceClient
      company={company}
      enabledTools={enabledTools}
      toolGroups={toolGroups}
      repos={repos}
      repoModules={repoModules}
      mcpServers={mcpServers}
      personas={personas}
      isAdmin={isAdmin}
      adminKey={key ?? null}
    />
  )
}
