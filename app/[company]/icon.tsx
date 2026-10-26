import { ImageResponse } from 'next/og'
import { sql } from '@/lib/db'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

// Per-company tab icon: the company's brand color with its initial, so each white-labeled agent is recognizable in a tab.
export default async function Icon({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params
  const rows = await sql`SELECT name, color FROM companies WHERE id = ${slug}`
  const name = (rows[0]?.name as string | undefined) ?? 'M'
  const color = (rows[0]?.color as string | undefined) ?? '#b41504'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 700 }}>
        {name.charAt(0).toUpperCase()}
      </div>
    ),
    size,
  )
}
