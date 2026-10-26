'use client'

import type { Company, Persona, PersonaModule, CompanyTool } from '@/lib/types'

const SYSTEM_META: Record<string, { label: string; description: string }> = {
  lims:    { label: 'LIMS',    description: 'Lab Information Management' },
  qms:     { label: 'QMS',     description: 'Quality Management System' },
  rosetta: { label: 'Rosetta', description: 'Data Normalization & Translation' },
}


function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <label className="relative cursor-pointer flex-shrink-0" style={{ width: 34, height: 18 }} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={active} onChange={onChange} className="sr-only" />
      <span className="absolute inset-0 transition-colors duration-150" style={{ background: active ? 'var(--teal)' : 'var(--border)', border: '1.5px solid var(--ink)' }} />
      <span className="absolute top-[3px] w-3 h-3 transition-transform duration-150" style={{ background: active ? '#fff' : 'var(--ink)', transform: active ? 'translateX(19px)' : 'translateX(3px)' }} />
    </label>
  )
}

function StepLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-6 h-[2px]" style={{ background: 'var(--teal)' }} />
      <span
        className="text-[10px] font-medium tracking-[.16em] uppercase"
        style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}
      >
        {n} · {children}
      </span>
    </div>
  )
}

interface Props {
  company: Company
  persona: Persona
  modules: PersonaModule[]
  tools: CompanyTool[]
  activeModuleIds: number[]
  activeToolIds: string[]
  onToggleModule: (id: number) => void
  onToggleServer: (prefix: string) => void
  onRelaunch: () => void
  onCollapse: () => void
}

export function ConfigPanel({
  company, persona, modules, tools,
  activeModuleIds, activeToolIds,
  onToggleModule, onToggleServer, onRelaunch, onCollapse,
}: Props) {
  const tokenTotal = modules
    .filter((m) => activeModuleIds.includes(m.id) && m.tokens)
    .reduce((sum, m) => sum + (m.tokens ?? 0), 0)
  const tokenPct = Math.min(100, (tokenTotal / 128000) * 100)

  const servers = Array.from(new Set(tools.map((t) => t.tool_id.split('_')[0]))).map((prefix) => ({
    prefix,
    meta: SYSTEM_META[prefix] ?? { label: prefix.toUpperCase(), description: 'Data system' },
    tools: tools.filter((t) => t.tool_id.startsWith(prefix + '_')),
  }))

  function serverActive(prefix: string) {
    const stools = tools.filter((t) => t.tool_id.startsWith(prefix + '_'))
    return stools.length > 0 && stools.every((t) => activeToolIds.includes(t.tool_id))
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 border-r overflow-hidden"
      style={{ width: 344, background: 'var(--surface)', borderRight: '2px solid var(--ink)' }}
    >
      {/* Persona header */}
      <div
        className="px-5 py-4 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--teal-softer)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[17px] font-semibold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{persona.name}</div>
            {persona.description && (
              <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{persona.description}</div>
            )}
            <div
              className="text-[10px] mt-1.5 tracking-[.04em]"
              style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}
            >
              {company.name} · {activeModuleIds.length} mod · {activeToolIds.length} tools
            </div>
            <div className="mt-2 text-[9.5px] px-1.5 py-0.5 w-fit tracking-[.08em] uppercase" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-3)' }}>
              Session config — temporary
            </div>
          </div>
          <button
            onClick={onCollapse}
            className="flex-shrink-0 text-xs px-2 py-1 rounded-lg border transition-colors mt-0.5"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-4)', background: 'transparent' }}
            title="Collapse panel"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Scrollable steps */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

        {/* 01 Context Modules */}
        <div>
          <StepLabel n="01">Context</StepLabel>
          <div className="space-y-2">
            {modules.map((m) => {
              const active = activeModuleIds.includes(m.id)
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-all"
                  style={{
                    background: 'var(--surface)',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    boxShadow: active ? 'var(--sh)' : 'none',
                    opacity: active ? 1 : 0.6,
                  }}
                  onClick={() => onToggleModule(m.id)}
                >
                  <span className="text-[9.5px] font-medium tracking-[.08em] uppercase px-1.5 py-0.5 flex-shrink-0 order-last"
                    style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--teal-softer)', color: 'var(--teal-ink)', border: '1px solid var(--teal-soft)' }}>
                    {m.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{m.name}</div>
                    {m.description && (
                      <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {m.tokens && (
                      <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                        {m.tokens.toLocaleString()}t
                      </span>
                    )}
                    <Toggle active={active} onChange={() => onToggleModule(m.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 02 MCP Tools */}
        <div>
          <StepLabel n="02">MCP Tools</StepLabel>
          <div className="space-y-2">
            {servers.map(({ prefix, meta, tools: stools }) => {
              const active = serverActive(prefix)
              return (
                <div
                  key={prefix}
                  className="overflow-hidden"
                  style={{
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                    boxShadow: active ? 'var(--sh)' : 'none',
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: 'var(--surface)',
                      opacity: active ? 1 : 0.6,
                    }}
                    onClick={() => onToggleServer(prefix)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{meta.label}</div>
                      <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                        {meta.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                        {stools.length} tools
                      </span>
                      <Toggle active={active} onChange={() => onToggleServer(prefix)} />
                    </div>
                  </div>
                  {active && (
                    <div
                      className="px-3.5 py-2 flex flex-wrap gap-1 border-t"
                      style={{ borderColor: 'var(--border-2)', background: 'var(--teal-softer)' }}
                    >
                      {stools.map((t) => (
                        <span
                          key={t.tool_id}
                          className="text-[10px] tracking-[.02em] px-1.5 py-0.5 border"
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            background: 'var(--surface)',
                            borderColor: 'var(--teal-soft)',
                            color: 'var(--teal-ink)',
                          }}
                        >
                          {t.tool_id.slice(prefix.length + 1)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0" style={{ borderTop: '2px solid var(--ink)' }}>
        {/* Token bar */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[10px] tracking-[.1em] uppercase"
              style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}
            >
              Context
            </span>
            <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>
              <strong style={{ color: 'var(--ink)' }}>{tokenTotal.toLocaleString()}</strong> tokens
            </span>
          </div>
          <div className="h-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${tokenPct}%`,
                background: tokenPct > 90 ? 'var(--danger)' : tokenPct > 70 ? 'var(--warn)' : 'var(--teal)',
              }}
            />
          </div>
        </div>
        {/* Relaunch */}
        <div className="p-4">
          <button
            onClick={onRelaunch}
            className="hard-btn w-full py-2.5 text-sm tracking-[.01em]"
          >
            New Session →
          </button>
        </div>
      </div>
    </aside>
  )
}
