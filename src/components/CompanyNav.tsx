'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Props {
  slug: string
  name: string
  color: string
  tagline?: string
}

const TABS = [
  { label: 'Marketplace', href: (slug: string) => `/${slug}/marketplace` },
  { label: 'Personas',    href: (slug: string) => `/${slug}/personas` },
  { label: 'Session',     href: (slug: string) => `/${slug}` },
]

function NavInner({ slug, name, color, tagline = 'by MadStack' }: Props) {
  const pathname = usePathname()
  const params = useSearchParams()
  const key = params.get('key')
  const keyParam = key ? `?key=${key}` : ''
  const isAdmin = !!key

  function isActive(tabHref: string) {
    const base = tabHref.split('?')[0]
    if (base === `/${slug}`) return pathname === `/${slug}`
    return pathname.startsWith(base)
  }

  return (
    <header
      className="flex items-center gap-8 px-7 flex-shrink-0 border-b border-white/10"
      style={{ background: color, height: 54 }}
    >
      {/* Brand */}
      <div className="flex flex-col leading-tight flex-shrink-0">
        <span className="text-white font-bold text-[15px] tracking-tight">{name} Demo</span>
        <span
          className="text-[10px] font-medium tracking-[.08em] opacity-50"
          style={{ fontFamily: 'var(--font-mono, monospace)', color: '#fff' }}
        >
          {tagline}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex h-full">
        {TABS.map((tab) => {
          const href = tab.href(slug) + keyParam
          const active = isActive(tab.href(slug))
          return (
            <Link
              key={tab.label}
              href={href}
              className="flex items-center px-4 text-[13px] font-medium border-b-2 transition-colors"
              style={{
                height: 54,
                color: active ? '#fff' : 'rgba(255,255,255,.45)',
                borderBottomColor: active ? 'rgba(255,255,255,0.85)' : 'transparent',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Right: admin badge + status */}
      <div className="ml-auto flex items-center gap-3">
        {isAdmin && (
          <span
            className="text-[10px] font-medium tracking-[.08em] uppercase px-2.5 py-1 rounded-full border"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              background: 'rgba(250,204,21,.2)',
              color: '#fde047',
              borderColor: 'rgba(250,204,21,.4)',
            }}
          >
            Admin
          </span>
        )}
        <span
          className="text-[10px] font-medium tracking-[.08em] uppercase px-2.5 py-1 rounded-full border"
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            background: 'rgba(255,255,255,.12)',
            color: 'rgba(255,255,255,.8)',
            borderColor: 'rgba(255,255,255,.2)',
          }}
        >
          Active
        </span>
      </div>
    </header>
  )
}

export function CompanyNav(props: Props) {
  return (
    <Suspense fallback={
      <header
        className="flex items-center px-7 flex-shrink-0 border-b border-white/10"
        style={{ background: props.color, height: 54 }}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-white font-bold text-[15px] tracking-tight">{props.name} Demo</span>
          <span className="text-[10px] opacity-50 text-white" style={{ fontFamily: 'var(--font-mono, monospace)' }}>by MadStack</span>
        </div>
      </header>
    }>
      <NavInner {...props} />
    </Suspense>
  )
}
