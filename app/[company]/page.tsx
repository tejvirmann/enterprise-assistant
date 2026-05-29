import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { CompanyStudio } from '@/components/CompanyStudio'
import type { Company, Persona, PersonaModule, CompanyTool, BrandConfig } from '@/lib/types'

interface Props {
  params: Promise<{ company: string }>
}

async function getCompanyData(slug: string) {
  const companies = await sql`
    SELECT * FROM companies WHERE id = ${slug}
  `
  if (!companies.length) return null
  const company = companies[0] as Company

  if (!company.default_persona_id) return null

  const personas = await sql`
    SELECT * FROM personas WHERE id = ${company.default_persona_id}
  `
  if (!personas.length) return null
  const persona = personas[0] as Persona

  const modules = await sql`
    SELECT * FROM persona_modules
    WHERE persona_id = ${persona.id}
    ORDER BY type, name
  ` as PersonaModule[]

  const tools = await sql`
    SELECT * FROM company_tools
    WHERE company_id = ${company.id} AND enabled = true
    ORDER BY tool_id
  ` as CompanyTool[]

  return { company, persona, modules, tools }
}

export default async function CompanyPage({ params }: Props) {
  const { company: slug } = await params
  const data = await getCompanyData(slug)

  if (!data) notFound()

  const cfg = ((data.company as Company & { brand_config?: BrandConfig }).brand_config ?? {}) as BrandConfig
  return <CompanyStudio data={data} chatWelcome={cfg.chat_welcome} />
}

export async function generateMetadata({ params }: Props) {
  const { company: slug } = await params
  const companies = await sql`SELECT name FROM companies WHERE id = ${slug}`
  const name = companies[0]?.name ?? slug
  return { title: `${name} — Enterprise Assistant` }
}
