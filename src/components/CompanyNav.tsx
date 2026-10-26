'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Props {
  slug: string
  name: string
  color: string
  tagline?: string
  logoUrl?: string
}

const TABS = [
  { label: 'Marketplace',  href: (slug: string) => `/${slug}/marketplace` },
  { label: 'Personas',     href: (slug: string) => `/${slug}/personas` },
  { label: 'Session',      href: (slug: string) => `/${slug}` },
]

const MONO = { fontFamily: 'var(--font-mono, monospace)' }

function Mark({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} style={{ height: 30, width: 30, objectFit: 'cover', border: '1.5px solid var(--ink)', boxShadow: '3px 3px 0 var(--tint)' }} />
  }
  return (
    <div
      className="grid place-items-center font-bold"
      style={{ width: 30, height: 30, background: 'var(--brand)', color: 'var(--on-accent)', border: '1.5px solid var(--ink)', boxShadow: '3px 3px 0 var(--tint)', fontFamily: 'var(--font-display)', fontSize: 15 }}
    >
      {name.charAt(0)}
    </div>
  )
}

function NavInner({ slug, name, tagline = 'by MadStack', logoUrl }: Props) {
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
      className="flex items-center gap-7 max-md:gap-3 px-5 max-md:px-3 flex-shrink-0 relative z-20"
      style={{ background: 'var(--surface)', height: 56, borderBottom: '2px solid var(--ink)' }}
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        <Mark name={name} logoUrl={logoUrl} />
        <div className="flex flex-col leading-tight max-md:hidden">
          <span className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-.01em' }}>{name}</span>
          <span className="text-[10px] font-medium tracking-[.1em] uppercase" style={{ ...MONO, color: 'var(--ink-3)' }}>{tagline}</span>
        </div>
      </div>

      <nav className="flex h-full min-w-0 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const active = isActive(tab.href(slug))
          return (
            <Link
              key={tab.label}
              href={tab.href(slug) + keyParam}
              className="flex items-center px-4 max-md:px-2 text-[14px] max-md:text-[13px] font-medium whitespace-nowrap transition-colors"
              style={{
                color: active ? 'var(--ink)' : 'var(--ink-3)',
                borderBottom: `3px solid ${active ? 'var(--brand)' : 'transparent'}`,
                marginBottom: -2,
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3 max-md:hidden">
        {isAdmin && (
          <span className="text-[10.5px] font-medium tracking-[.1em] uppercase px-2.5 py-1" style={{ ...MONO, background: '#fff3c4', border: '1.5px solid var(--ink)' }}>
            Admin
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[10.5px] font-medium tracking-[.1em] uppercase px-2.5 py-1" style={{ ...MONO, background: 'var(--tint)', border: '1.5px solid var(--ink)' }}>
          <i className="block w-[7px] h-[7px]" style={{ background: 'var(--success)' }} />
          Active
        </span>
      </div>
    </header>
  )
}

export function CompanyNav(props: Props) {
  return (
    <Suspense fallback={
      <header className="flex items-center px-5 flex-shrink-0" style={{ background: 'var(--surface)', height: 56, borderBottom: '2px solid var(--ink)' }}>
        <div className="flex items-center gap-3"><Mark name={props.name} logoUrl={props.logoUrl} /><span className="text-[15px] font-semibold">{props.name}</span></div>
      </header>
    }>
      <NavInner {...props} />
    </Suspense>
  )
}
