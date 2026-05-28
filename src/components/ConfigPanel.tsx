'use client'

import type { Company, Persona, PersonaModule, CompanyTool } from '@/lib/types'

const SYSTEM_META: Record<string, { label: string; description: string }> = {
  lims:    { label: 'LIMS',    description: 'Lab Information Management' },
  qms:     { label: 'QMS',     description: 'Quality Management System' },
  rosetta: { label: 'Rosetta', description: 'Data Normalization & Translation' },
}

const TYPE_BADGE: Record<string, string> = {
  skill:     'bg-[#e6f1ef] text-[#15716a]',
  blueprint: 'bg-purple-50 text-purple-700',
  agent:     'bg-green-50 text-green-700',
  command:   'bg-amber-50 text-amber-700',
}

function Toggle({ active, onChange }: { active: boolean; onChange: () => void }) {
  return (
    <label className="relative cursor-pointer flex-shrink-0" style={{ width: 34, height: 18 }}>
      <input type="checkbox" checked={active} onChange={onChange} className="sr-only" />
      <span
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ background: active ? 'var(--teal)' : '#cbd5e1' }}
      />
      <span
        className="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform duration-200"
        style={{ transform: active ? 'translateX(19px)' : 'translateX(3px)' }}
      />
    </label>
  )
}

function StepLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="w-5 h-px opacity-50" style={{ background: 'var(--teal)' }} />
      <span
        className="text-[10px] font-medium tracking-[.16em] uppercase"
        style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--teal)' }}
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
}

export function ConfigPanel({
  company, persona, modules, tools,
  activeModuleIds, activeToolIds,
  onToggleModule, onToggleServer, onRelaunch,
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
      style={{ width: 320, background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Persona header */}
      <div
        className="px-5 py-4 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border)', borderLeftWidth: 3, borderLeftColor: 'var(--brand)' }}
      >
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{persona.name}</div>
        {persona.description && (
          <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>{persona.description}</div>
        )}
        <div
          className="text-[10px] mt-1.5 tracking-[.04em]"
          style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}
        >
          {company.name} · {activeModuleIds.length} modules · {activeToolIds.length} tools
        </div>
      </div>

      {/* Scrollable steps */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

        {/* 01 Context Modules */}
        <div>
          <StepLabel n="01">Context Modules</StepLabel>
          <div className="space-y-2">
            {modules.map((m) => {
              const active = activeModuleIds.includes(m.id)
              const badgeCls = TYPE_BADGE[m.type] ?? 'bg-slate-100 text-slate-600'
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all"
                  style={{
                    background: active ? 'var(--teal-softer)' : 'var(--surface)',
                    borderColor: active ? 'var(--teal)' : 'var(--border)',
                    borderLeftWidth: active ? 3 : 1,
                    opacity: active ? 1 : 0.5,
                  }}
                  onClick={() => onToggleModule(m.id)}
                >
                  <span className={`${badgeCls} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0`}
                    style={{ fontFamily: 'var(--font-mono, monospace)' }}>
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
                  className="rounded-lg border overflow-hidden"
                  style={{
                    borderColor: active ? 'var(--teal)' : 'var(--border)',
                    borderLeftWidth: active ? 3 : 1,
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: active ? 'var(--teal-softer)' : 'var(--surface)',
                      opacity: active ? 1 : 0.5,
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
                          className="text-[9px] tracking-[.04em] px-1.5 py-0.5 rounded-full border"
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
      <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
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
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
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
            className="w-full py-2.5 rounded-full text-sm font-semibold text-white tracking-[.01em] transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand)' }}
          >
            Relaunch Agent →
          </button>
        </div>
      </div>
    </aside>
  )
}
