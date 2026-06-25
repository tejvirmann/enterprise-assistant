import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PersonasClient } from '@/components/PersonasClient'
import { getEffectiveModules } from '@/lib/presets'
import type { Company, Persona, PersonaModule, Repo, RepoModule } from '@/lib/types'

interface Props {
  params: Promise<{ company: string }>
  searchParams: Promise<{ key?: string }>
}

export default async function PersonasPage({ params, searchParams }: Props) {
  const { company: slug } = await params
  const { key } = await searchParams

  const companies = await sql`SELECT * FROM companies WHERE id = ${slug}`
  if (!companies.length) notFound()
  const company = companies[0] as Company & { admin_key?: string }

  const isAdmin = !!key && key === company.admin_key

  const personas = await sql`
    SELECT p.*, COUNT(pm.id)::int AS module_count
    FROM personas p
    LEFT JOIN persona_modules pm ON pm.persona_id = p.id
    WHERE p.company_id = ${slug}
    GROUP BY p.id ORDER BY p.created_at
  ` as (Persona & { module_count: number })[]

  const ownModules = await sql`
    SELECT pm.* FROM persona_modules pm
    JOIN personas p ON pm.persona_id = p.id
    WHERE p.company_id = ${slug}
    ORDER BY pm.persona_id, pm.type, pm.name
  ` as PersonaModule[]

  // Preset-provided modules attach only to the company's default persona.
  const modules: (PersonaModule & { source: 'preset' | 'company' })[] = ownModules.map((m) => ({ ...m, source: 'company' }))
  if (company.default_persona_id) {
    const effective = await getEffectiveModules(slug, company.default_persona_id)
    modules.push(...effective.filter((m) => m.source === 'preset'))
  }

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

  return (
    <PersonasClient
      company={company}
      personas={personas}
      modules={modules}
      repos={repos}
      repoModules={repoModules}
      isAdmin={isAdmin}
      adminKey={key ?? null}
    />
  )
}
