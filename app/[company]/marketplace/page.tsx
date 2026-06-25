import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ALL_TOOLS } from '@/tools/index'
import { getEffectiveTools, getEffectiveMcpServers } from '@/lib/presets'
import { MarketplaceClient } from '@/components/MarketplaceClient'
import type { Company, Persona, Repo, RepoModule } from '@/lib/types'

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

  const effectiveTools = await getEffectiveTools(slug)
  const enabledTools = effectiveTools.filter((t) => t.enabled).map((t) => t.tool_id)
  const presetToolIds = new Set(effectiveTools.filter((t) => t.source === 'preset').map((t) => t.tool_id))

  // When a company is linked to a preset, only show built-in tool groups that are
  // relevant to it (in the preset, or already configured directly on the company) —
  // keeps e.g. a finance deployment's Marketplace from being cluttered with LIMS/QMS.
  // Companies with no preset see the full catalog, same as before presets existed.
  const visiblePrefixes = company.preset_id
    ? new Set(effectiveTools.map((t) => t.tool_id.split('_')[0]))
    : null

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

  const mcpServers = (await getEffectiveMcpServers(slug)).sort((a, b) => a.created_at.localeCompare(b.created_at))

  const allToolGroups = buildToolGroups()
  const toolGroups = visiblePrefixes
    ? Object.fromEntries(Object.entries(allToolGroups).filter(([prefix]) => visiblePrefixes.has(prefix)))
    : allToolGroups

  return (
    <MarketplaceClient
      company={company}
      enabledTools={enabledTools}
      presetToolIds={[...presetToolIds]}
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
