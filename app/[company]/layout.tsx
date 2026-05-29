export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { CompanyNav } from '@/components/CompanyNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ company: string }>
}

export default async function CompanyLayout({ children, params }: Props) {
  const { company: slug } = await params

  const rows = await sql`SELECT id, name, color FROM companies WHERE id = ${slug}`
  if (!rows.length) notFound()

  const company = rows[0]

  return (
    <div className="flex flex-col h-screen">
      <CompanyNav
        slug={company.id as string}
        name={company.name as string}
        color={company.color as string}
      />
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
