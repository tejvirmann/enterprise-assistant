export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { CompanyNav } from '@/components/CompanyNav'
import { buildThemeCss, type BrandConfig } from '@/lib/theme'
import { companyColor } from '@/lib/brand'

interface Props {
  children: React.ReactNode
  params: Promise<{ company: string }>
}

export default async function CompanyLayout({ children, params }: Props) {
  const { company: slug } = await params

  const rows = await sql`SELECT id, name, color, brand_config FROM companies WHERE id = ${slug}`
  if (!rows.length) notFound()

  const company = rows[0]
  const cfg = (company.brand_config ?? {}) as BrandConfig
  const color = companyColor(slug, company.color as string)
  const themeCss = buildThemeCss(color, cfg)

  return (
    <div className="flex flex-col h-screen">
      {/* Inject per-company CSS variable overrides */}
      <style dangerouslySetInnerHTML={{ __html: `:root{${themeCss}}` }} />
      <CompanyNav
        slug={company.id as string}
        name={company.name as string}
        color={color}
        tagline={cfg.tagline}
        logoUrl={cfg.logo_url}
      />
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
