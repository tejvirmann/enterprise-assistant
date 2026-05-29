import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PersonasClient } from '@/components/PersonasClient'
import type { Company, Persona, PersonaModule } from '@/lib/types'

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

  const modules = await sql`
    SELECT pm.* FROM persona_modules pm
    JOIN personas p ON pm.persona_id = p.id
    WHERE p.company_id = ${slug}
    ORDER BY pm.persona_id, pm.type, pm.name
  ` as PersonaModule[]

  return (
    <PersonasClient
      company={company}
      personas={personas}
      modules={modules}
      isAdmin={isAdmin}
      adminKey={key ?? null}
    />
  )
}
