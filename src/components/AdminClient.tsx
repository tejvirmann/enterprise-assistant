'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Company, Persona } from '@/lib/types'
import type { BrandConfig } from '@/lib/theme'

interface ToolCount { company_id: string; total: number; enabled: number }
interface McpCount  { company_id: string; total: number; enabled: number }

interface Props {
  companies: Company[]
  personas: (Persona & { module_count: number })[]
  toolCounts: ToolCount[]
  mcpCounts: McpCount[]
  adminKey: string
}

function toast(msg: string, ok = true) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.12);${ok ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0' : 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca'}`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

function NavPreview({ name, color, logoUrl, tagline }: { name: string; color: string; logoUrl?: string; tagline?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(0,0,0,.1)' }}>
      <div className="flex items-center gap-4 px-4" style={{ background: color, height: 44 }}>
        <div className="flex items-center gap-2.5">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ height: 26, width: 26, borderRadius: 5, boxShadow: '0 0 0 1px rgba(255,255,255,0.2)' }} />
          )}
          <div>
            <div className="text-white font-semibold text-[13px] leading-tight">{name || 'Company Name'}</div>
            {tagline && <div className="text-white/50 text-[9px] font-mono leading-tight">{tagline}</div>}
          </div>
        </div>
        <div className="flex gap-3 ml-2">
          {['Marketplace', 'Personas', 'Session'].map((t) => (
            <span key={t} className="text-white/50 text-[11px]">{t}</span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.8)', border: '1px solid rgba(255,255,255,.2)' }}>Active</span>
        </div>
      </div>
      <div className="h-8" style={{ background: `color-mix(in srgb, ${color} 6%, white)` }} />
    </div>
  )
}

export function AdminClient({ companies, personas, toolCounts, mcpCounts, adminKey }: Props) {
  const router = useRouter()
  const [activeSlug, setActiveSlug] = useState<string>(companies[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  const co = companies.find((c) => c.id === activeSlug)
  const cfg = ((co as Company & { brand_config?: BrandConfig })?.brand_config ?? {}) as BrandConfig

  // Editable fields
  const [name, setName] = useState(co?.name ?? '')
  const [description, setDescription] = useState(co?.description ?? '')
  const [color, setColor] = useState(co?.color ?? '#369996')
  const [tagline, setTagline] = useState(cfg.tagline ?? '')
  const [chatWelcome, setChatWelcome] = useState(cfg.chat_welcome ?? '')
  const [logoUrl, setLogoUrl] = useState(cfg.logo_url ?? '')
  const [bg, setBg] = useState(cfg.bg ?? '')
  const [surface, setSurface] = useState(cfg.surface ?? '')
  const [border, setBorder] = useState(cfg.border ?? '')
  const [companyAdminKey, setCompanyAdminKey] = useState(co?.admin_key ?? '')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const loadCompany = useCallback((c: Company) => {
    const b = ((c as Company & { brand_config?: BrandConfig }).brand_config ?? {}) as BrandConfig
    setActiveSlug(c.id)
    setName(c.name)
    setDescription(c.description ?? '')
    setColor(c.color)
    setTagline(b.tagline ?? '')
    setChatWelcome(b.chat_welcome ?? '')
    setLogoUrl(b.logo_url ?? '')
    setBg(b.bg ?? '')
    setSurface(b.surface ?? '')
    setBorder(b.border ?? '')
    setCompanyAdminKey(c.admin_key ?? '')
    setShowAdvanced(false)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/company/${activeSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey, name, description, color, tagline, chat_welcome: chatWelcome,
          logo_url: logoUrl, bg: bg || undefined, surface: surface || undefined, border: border || undefined,
          company_admin_key: companyAdminKey || undefined,
        }),
      })
      if (!res.ok) { toast('Save failed', false); return }
      toast('Saved')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const coPersonas = personas.filter((p) => p.company_id === activeSlug)
  const tools = toolCounts.find((t) => t.company_id === activeSlug)
  const mcps = mcpCounts.find((m) => m.company_id === activeSlug)

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/madstack-icon.svg" alt="MadStack" style={{ height: 26, width: 26, borderRadius: 5 }} />
            <div>
              <div className="text-[13px] font-semibold text-gray-800">Admin Panel</div>
              <div className="text-[10px] text-gray-400 font-mono">by MadStack</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-2">
            <p className="text-[9px] font-semibold tracking-[.12em] uppercase text-gray-400 px-2 mb-1">Companies</p>
            {companies.map((c) => {
              const isActive = c.id === activeSlug
              return (
                <button
                  key={c.id}
                  onClick={() => loadCompany(c)}
                  className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors mb-0.5"
                  style={{ background: isActive ? `color-mix(in srgb, ${c.color} 8%, white)` : 'transparent' }}
                >
                  <span className="w-3 h-3 rounded-sm flex-shrink-0 ring-1 ring-black/10" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-gray-700 truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">{c.id}</div>
                  </div>
                  {isActive && <span className="text-[10px] text-gray-400">›</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-mono">{companies.length} companies</p>
        </div>
      </aside>

      {/* Main pane */}
      {co ? (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-800">{co.name}</h1>
                <p className="text-sm text-gray-400 font-mono mt-0.5">/{co.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/${co.id}?key=${co.admin_key ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                >
                  Open Site →
                </a>
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-xs px-5 py-1.5 rounded-full font-semibold text-white disabled:opacity-60"
                  style={{ background: color }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Nav Preview */}
            <div>
              <p className="text-[11px] font-semibold tracking-[.1em] uppercase text-gray-400 mb-2">Preview</p>
              <NavPreview name={name} color={color} logoUrl={logoUrl || undefined} tagline={tagline || undefined} />
            </div>

            {/* Branding */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <p className="text-[11px] font-semibold tracking-[.1em] uppercase text-gray-400">Branding</p>

              {/* Color */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Brand color</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg ring-1 ring-black/10 cursor-pointer" style={{ background: color }} />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Pick color"
                    />
                  </div>
                  <input
                    value={color}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value) }}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none font-mono focus:border-gray-400"
                    placeholder="#f97316"
                    maxLength={7}
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {['#f97316','#0e7490','#212154','#166534','#2563eb','#7c3aed','#db2777','#1f2937'].map((c) => (
                      <button key={c} onClick={() => setColor(c)}
                        className="w-5 h-5 rounded ring-1 ring-black/10 hover:scale-110 transition-transform"
                        style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Display name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400"
                    placeholder="Company Name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Tagline</label>
                  <input value={tagline} onChange={(e) => setTagline(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400"
                    placeholder="by MadStack" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400"
                  placeholder="Short description of this deployment" />
              </div>

              {/* Chat welcome */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Chat welcome message</label>
                <input value={chatWelcome} onChange={(e) => setChatWelcome(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-gray-400"
                  placeholder="Agent is ready. Try a prompt or type your own." />
              </div>

              {/* Logo URL */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Logo URL <span className="text-gray-400 font-normal">(path to file in /public)</span></label>
                <div className="flex items-center gap-2">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" style={{ height: 28, width: 28, borderRadius: 5, border: '1px solid #e5e7eb' }} />
                  )}
                  <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none font-mono focus:border-gray-400"
                    placeholder="/madstack-icon.svg" />
                </div>
              </div>

              {/* Advanced CSS overrides */}
              <div>
                <button onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
                  <span>{showAdvanced ? '▾' : '▸'}</span> CSS variable overrides
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { label: '--bg', value: bg, set: setBg, placeholder: '#fff7ed' },
                      { label: '--surface', value: surface, set: setSurface, placeholder: '#ffffff' },
                      { label: '--border', value: border, set: setBorder, placeholder: 'auto' },
                    ].map(({ label, value, set, placeholder }) => (
                      <div key={label}>
                        <label className="text-[10px] font-mono text-gray-500 block mb-1">{label}</label>
                        <input value={value} onChange={(e) => set(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 outline-none font-mono focus:border-gray-400"
                          placeholder={placeholder} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Personas + context */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold tracking-[.1em] uppercase text-gray-400">Personas & Context</p>
                <a
                  href={`/${co.id}/personas?key=${co.admin_key ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Manage →
                </a>
              </div>
              {coPersonas.length === 0 ? (
                <p className="text-sm text-gray-400">No personas yet.</p>
              ) : (
                <div className="space-y-2">
                  {coPersonas.map((p) => {
                    const isDefault = co.default_persona_id === p.id
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ background: '#f9fafb' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium text-gray-700">{p.name}</span>
                            {isDefault && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: `color-mix(in srgb, ${color} 10%, white)`, color: color }}>default</span>
                            )}
                          </div>
                          {p.description && <p className="text-xs text-gray-400 truncate mt-0.5">{p.description}</p>}
                        </div>
                        <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">
                          {p.module_count} module{p.module_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tools summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold tracking-[.1em] uppercase text-gray-400">Tools & MCP Servers</p>
                <a
                  href={`/${co.id}/marketplace?key=${co.admin_key ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Manage →
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: '#f9fafb' }}>
                  <div className="text-xl font-bold text-gray-800">{tools?.enabled ?? 0}<span className="text-sm font-normal text-gray-400"> / {tools?.total ?? 0}</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">Built-in tools enabled</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#f9fafb' }}>
                  <div className="text-xl font-bold text-gray-800">{mcps?.enabled ?? 0}<span className="text-sm font-normal text-gray-400"> / {mcps?.total ?? 0}</span></div>
                  <div className="text-xs text-gray-500 mt-0.5">External MCP servers active</div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <p className="text-[11px] font-semibold tracking-[.1em] uppercase text-gray-400">Security</p>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Company admin key <span className="text-gray-400 font-normal">(?key= in URL to enable persistent edits)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input value={companyAdminKey} onChange={(e) => setCompanyAdminKey(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 outline-none font-mono focus:border-gray-400"
                    placeholder="e.g. findorff-admin" />
                  <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                    /{co.id}?key={companyAdminKey || co.admin_key || '…'}
                  </span>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pb-8">
              <button
                onClick={save}
                disabled={saving}
                className="px-8 py-2.5 rounded-full font-semibold text-white text-sm disabled:opacity-60"
                style={{ background: color }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

          </div>
        </main>
      ) : (
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Select a company</p>
        </main>
      )}
    </div>
  )
}
