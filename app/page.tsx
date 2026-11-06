import Link from 'next/link'
import { sql } from '@/lib/db'
import { companyColor } from '@/lib/brand'
import { DEMO_DIRECTORY as DEMOS, EXTERNAL_DEMOS } from '@/lib/demos'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Live agent demos' }

export default async function Home() {
  const rows = (await sql`SELECT id, name, color FROM companies WHERE id = ANY(${DEMOS.map(d => d.slug)})`) as { id: string; name: string; color: string }[]
  const byId = new Map(rows.map(r => [r.id, r]))
  const demos = DEMOS.filter(d => byId.has(d.slug))

  return (
    <main className="min-h-screen px-6 py-14 max-md:px-4">
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] font-medium uppercase tracking-[.12em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
          MadStack · Enterprise Assistant
        </p>
        <h1 className="mt-2 text-4xl font-bold max-md:text-3xl">Live agent demos</h1>
        <p className="mt-3 max-w-2xl text-[15px]" style={{ color: 'var(--ink-2)' }}>
          Each demo is an AI agent with access to a company’s own tools and knowledge, running on sample data. Pick one and ask it a question.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 max-md:grid-cols-1">
          {demos.map(d => {
            const c = byId.get(d.slug)!
            const color = companyColor(d.slug, c.color)
            return (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className="hard-card group flex flex-col p-5 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
                style={{ borderTopWidth: 6, borderTopColor: color }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-semibold">{c.name}</h2>
                  <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>/{d.slug}</span>
                </div>
                <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-2)' }}>{d.blurb}</p>
                <p className="mt-4 text-[12px]" style={{ color: 'var(--ink-3)' }}>Try asking</p>
                <p className="text-[13px] italic" style={{ color: 'var(--ink)' }}>“{d.tryAsking}”</p>
                <div className="mt-auto pt-5"><span className="hard-btn inline-block px-4 py-2 text-[13px]">Open demo →</span></div>
              </Link>
            )
          })}
          {EXTERNAL_DEMOS.map(e => (
            <a
              key={e.slug}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hard-card group flex flex-col p-5 transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
              style={{ borderTopWidth: 6, borderTopColor: 'var(--ink)' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold">{e.name}</h2>
                <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>MCP server ↗</span>
              </div>
              <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-2)' }}>{e.blurb}</p>
              <p className="mt-4 text-[12px]" style={{ color: 'var(--ink-3)' }}>{e.tools.length} tools</p>
              <p className="text-[13px]" style={{ color: 'var(--ink)' }}>{e.tools.slice(0, 3).map(t => t.name.replace('tool_', '')).join(', ')}, …</p>
              <div className="mt-auto pt-5"><span className="hard-btn inline-block px-4 py-2 text-[13px]">Open demo ↗</span></div>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
