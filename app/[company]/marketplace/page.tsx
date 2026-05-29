import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { MarketplaceClient } from '@/components/MarketplaceClient'
import type { Company } from '@/lib/types'

interface Props {
  params: Promise<{ company: string }>
  searchParams: Promise<{ key?: string }>
}

export default async function MarketplacePage({ params, searchParams }: Props) {
  const { company: slug } = await params
  const { key } = await searchParams

  const companies = await sql`SELECT * FROM companies WHERE id = ${slug}`
  if (!companies.length) notFound()
  const company = companies[0] as Company

  const isAdmin = !!key && key === (company as Company & { admin_key?: string }).admin_key

  const enabledRows = await sql`
    SELECT tool_id FROM company_tools WHERE company_id = ${slug} AND enabled = true
  `
  const enabledTools = enabledRows.map((r) => r.tool_id as string)

  return (
    <MarketplaceClient
      company={company}
      enabledTools={enabledTools}
      isAdmin={isAdmin}
      adminKey={key ?? null}
    />
  )
}
