'use client'

import { useState } from 'react'
import type { Company, Persona, PersonaModule } from '@/lib/types'

interface Props {
  company: Company
  personas: (Persona & { module_count: number })[]
  modules: PersonaModule[]
  isAdmin: boolean
  adminKey: string | null
}

const TYPE_COLORS: Record<string, string> = {
  skill:     'bg-[#e6f1ef] text-[#15716a]',
  blueprint: 'bg-purple-50 text-purple-700',
  agent:     'bg-green-50 text-green-700',
  command:   'bg-amber-50 text-amber-700',
}

function toast(msg: string, ok = true) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(15,26,26,.12);${ok ? 'background:#e6f1ef;color:#15716a;border:1px solid rgba(54,153,150,.3)' : 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca'}`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

export function PersonasClient({ company, personas: initial, modules: initialModules, isAdmin, adminKey }: Props) {
  const [personas, setPersonas] = useState(initial)
  const [modules, setModules] = useState(initialModules)
  const [activeId, setActiveId] = useState(initial[0]?.id ?? null)
  const [showNewPersona, setShowNewPersona] = useState(false)
  const [showNewModule, setShowNewModule] = useState(false)

  const [npName, setNpName] = useState('')
  const [npDesc, setNpDesc] = useState('')
  const [nmName, setNmName] = useState('')
  const [nmType, setNmType] = useState('skill')
  const [nmDesc, setNmDesc] = useState('')
  const [nmContent, setNmContent] = useState('')
  const [nmTokens, setNmTokens] = useState('')

  const activePersona = personas.find((p) => p.id === activeId) ?? null
  const activeModules = modules.filter((m) => m.persona_id === activeId)

  async function createPersona() {
    if (!npName.trim()) return toast('Name required', false)
    try {
      const res = await fetch(`/api/company/${company.id}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: npName, description: npDesc, adminKey }),
      })
      if (!res.ok) {
        const body = await res.json()
        return toast(isAdmin ? (body.error ?? 'Error') : 'Provide ?key=xxx to save', false)
      }
      const { id } = await res.json()
      const newP = { id, company_id: company.id, name: npName, description: npDesc, scope: 'private', created_at: new Date().toISOString(), module_count: 0 }
      setPersonas((p) => [...p, newP])
      setActiveId(id)
      setNpName(''); setNpDesc('')
      setShowNewPersona(false)
      toast('Persona created' + (!isAdmin ? ' (session only)' : ''))
    } catch { toast('Failed', false) }
  }

  async function addModule() {
    if (!nmName.trim() || !activeId) return toast('Name required', false)
    try {
      const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nmName, type: nmType, description: nmDesc, content: nmContent, tokens: nmTokens ? parseInt(nmTokens) : null, adminKey }),
      })
      if (!res.ok) {
        return toast(isAdmin ? 'Error saving' : 'Provide ?key=xxx to persist', false)
      }
      const { id } = await res.json()
      const newMod: PersonaModule = {
        id, persona_id: activeId, repo_id: null, path: null,
        type: nmType, name: nmName, description: nmDesc || null,
        tokens: nmTokens ? parseInt(nmTokens) : null,
        enabled: true, content: nmContent || null,
      }
      setModules((m) => [...m, newMod])
      setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: x.module_count + 1 } : x))
      setNmName(''); setNmType('skill'); setNmDesc(''); setNmContent(''); setNmTokens('')
      setShowNewModule(false)
      toast('Module added' + (!isAdmin ? ' (session only)' : ''))
    } catch { toast('Failed', false) }
  }

  async function removeModule(moduleId: number) {
    try {
      await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, adminKey }),
      })
      setModules((m) => m.filter((x) => x.id !== moduleId))
      setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: Math.max(0, x.module_count - 1) } : x))
      toast('Removed' + (!isAdmin ? ' (session only)' : ''))
    } catch { toast('Failed', false) }
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="flex flex-col border-r flex-shrink-0" style={{ width: 240, background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10px] font-medium tracking-[.14em] uppercase" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>Personas</span>
          <button
            onClick={() => setShowNewPersona((v) => !v)}
            className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {personas.map((p) => (
            <div
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className="flex items-center gap-2 px-5 py-3 cursor-pointer border-l-2 transition-all"
              style={{
                background: p.id === activeId ? 'var(--teal-soft)' : 'transparent',
                borderLeftColor: p.id === activeId ? 'var(--teal)' : 'transparent',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{p.name}</div>
                <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                  {p.module_count} module{p.module_count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}

          {personas.length === 0 && (
            <p className="px-5 py-4 text-sm" style={{ color: 'var(--ink-4)' }}>No personas yet.</p>
          )}
        </div>

        {/* New persona form */}
        {showNewPersona && (
          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <p className="text-[10px] font-medium tracking-[.12em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>New Persona</p>
            <input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="Name" className="w-full text-xs px-3 py-2 rounded-lg border mb-2 outline-none" style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <textarea value={npDesc} onChange={(e) => setNpDesc(e.target.value)} placeholder="Description" className="w-full text-xs px-3 py-2 rounded-lg border mb-2 outline-none resize-none" rows={2} style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <div className="flex gap-2">
              <button onClick={createPersona} className="flex-1 text-xs py-1.5 rounded-lg font-semibold text-white" style={{ background: 'var(--teal)' }}>Create</button>
              <button onClick={() => setShowNewPersona(false)} className="flex-1 text-xs py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {!activePersona ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-4)' }}>
            <p className="text-sm">Select a persona or create a new one.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Persona header */}
            <div className="bg-white border-b px-8 py-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>{activePersona.name}</h2>
                  {activePersona.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>{activePersona.description}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setShowNewModule((v) => !v)}
                    className="text-xs px-4 py-2 rounded-full font-semibold text-white"
                    style={{ background: 'var(--teal)' }}
                  >
                    + Add Module
                  </button>
                </div>
              </div>
              {!isAdmin && (
                <p className="text-xs mt-2" style={{ color: 'var(--warn)' }}>
                  Add <code className="px-1 rounded" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}>?key=xxx</code> to the URL to persist changes.
                </p>
              )}
            </div>

            {/* Module list */}
            <div className="flex-1 px-8 py-5">
              {/* Add module form */}
              {showNewModule && (
                <div className="rounded-xl border p-5 mb-5 bg-white" style={{ borderColor: 'var(--teal)', boxShadow: 'var(--sh)' }}>
                  <p className="text-[10px] font-medium tracking-[.12em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--teal)' }}>New Module</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={nmName} onChange={(e) => setNmName(e.target.value)} placeholder="Name *" className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                    <select value={nmType} onChange={(e) => setNmType(e.target.value)} className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
                      <option value="skill">skill</option>
                      <option value="blueprint">blueprint</option>
                      <option value="agent">agent</option>
                      <option value="command">command</option>
                    </select>
                    <input value={nmTokens} onChange={(e) => setNmTokens(e.target.value)} placeholder="Tokens (est.)" type="number" className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                    <input value={nmDesc} onChange={(e) => setNmDesc(e.target.value)} placeholder="Description" className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                  </div>
                  <textarea
                    value={nmContent}
                    onChange={(e) => setNmContent(e.target.value)}
                    placeholder="Module content (Markdown) — instructions for the agent..."
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y mb-3"
                    rows={6}
                    style={{ borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
                  />
                  <div className="flex gap-2">
                    <button onClick={addModule} className="text-sm px-5 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Add Module</button>
                    <button onClick={() => setShowNewModule(false)} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
                  </div>
                </div>
              )}

              {activeModules.length === 0 && !showNewModule && (
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No modules yet. Click "+ Add Module" to add a skill or blueprint.</p>
              )}

              <div className="space-y-3">
                {activeModules.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 p-4 rounded-xl border bg-white" style={{ borderColor: 'var(--border)', boxShadow: 'var(--sh)' }}>
                    <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5`}
                      style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                      {m.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</div>
                      {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                      {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                      {m.content && (
                        <pre className="mt-2 text-[11px] p-2 rounded-lg overflow-hidden max-h-20 leading-relaxed" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface-2)', color: 'var(--ink-3)', border: '1px solid var(--border-2)' }}>
                          {m.content.slice(0, 300)}{m.content.length > 300 ? '…' : ''}
                        </pre>
                      )}
                    </div>
                    <button
                      onClick={() => removeModule(m.id)}
                      className="text-xs px-2 py-1 rounded flex-shrink-0 transition-colors"
                      style={{ color: 'var(--ink-4)', background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = '#fef2f2' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
