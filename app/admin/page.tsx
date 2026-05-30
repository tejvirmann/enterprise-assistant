export const dynamic = 'force-dynamic'

import { sql } from '@/lib/db'
import { AdminClient } from '@/components/AdminClient'
import type { Company, Persona } from '@/lib/types'

interface Props {
  searchParams: Promise<{ key?: string }>
}

export default async function AdminPage({ searchParams }: Props) {
  const { key } = await searchParams
  const secret = process.env.ADMIN_SECRET

  if (!secret || key !== secret) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center bg-white border border-gray-200 rounded-2xl px-10 py-8 shadow-sm max-w-sm w-full">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-600 text-lg">🔐</span>
          </div>
          <p className="text-[15px] font-semibold text-gray-800 mb-1">Admin access required</p>
          <p className="text-sm text-gray-500">
            Append <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">?key=xxx</code> to the URL
          </p>
        </div>
      </div>
    )
  }

  const companies = await sql`SELECT * FROM companies ORDER BY name` as Company[]

  const personas = await sql`
    SELECT p.id, p.company_id, p.name, p.description, p.created_at,
           COUNT(pm.id)::int AS module_count
    FROM personas p
    LEFT JOIN persona_modules pm ON pm.persona_id = p.id
    GROUP BY p.id
    ORDER BY p.company_id, p.created_at
  ` as (Persona & { module_count: number })[]

  const toolCounts = await sql`
    SELECT company_id, COUNT(*)::int AS total, SUM(CASE WHEN enabled THEN 1 ELSE 0 END)::int AS enabled
    FROM company_tools GROUP BY company_id
  ` as { company_id: string; total: number; enabled: number }[]

  const mcpCounts = await sql`
    SELECT company_id, COUNT(*)::int AS total, SUM(CASE WHEN enabled THEN 1 ELSE 0 END)::int AS enabled
    FROM company_mcp_servers GROUP BY company_id
  ` as { company_id: string; total: number; enabled: number }[]

  return (
    <AdminClient
      companies={companies}
      personas={personas}
      toolCounts={toolCounts}
      mcpCounts={mcpCounts}
      adminKey={key}
    />
  )
}

export const metadata = { title: 'Admin — Enterprise Assistant' }
