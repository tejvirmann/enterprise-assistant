'use client'

import { useState } from 'react'
import type { Company, Persona, PersonaModule, Repo, RepoModule } from '@/lib/types'

interface Props {
  company: Company
  personas: (Persona & { module_count: number })[]
  modules: PersonaModule[]
  repos: Repo[]
  repoModules: RepoModule[]
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

type View = 'detail' | 'picker' | 'manual'

export function PersonasClient({ company, personas: initial, modules: initialModules, repos, repoModules, isAdmin, adminKey }: Props) {
  const [personas, setPersonas] = useState(initial)
  const [modules, setModules] = useState(initialModules)
  const [activeId, setActiveId] = useState(initial[0]?.id ?? null)
  const [view, setView] = useState<View>('detail')
  const [showNewPersona, setShowNewPersona] = useState(false)
  const [pickerRepoId, setPickerRepoId] = useState<string | null>(repos[0]?.id ?? null)

  // New persona form
  const [npName, setNpName] = useState('')
  const [npDesc, setNpDesc] = useState('')

  // Manual module form
  const [nmName, setNmName] = useState('')
  const [nmType, setNmType] = useState('skill')
  const [nmDesc, setNmDesc] = useState('')
  const [nmContent, setNmContent] = useState('')
  const [nmTokens, setNmTokens] = useState('')

  const activePersona = personas.find((p) => p.id === activeId) ?? null
  const activeModules = modules.filter((m) => m.persona_id === activeId)

  // Modules grouped by repo for display
  const groupedModules = activeModules.reduce<Record<string, PersonaModule[]>>((acc, m) => {
    const key = m.repo_id ?? 'custom'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  // Picker state
  const pickerRepoModules = repoModules.filter((m) => m.repo_id === pickerRepoId)
  const activeModuleKeys = new Set(activeModules.map((m) => `${m.repo_id}::${m.path}`))

  async function createPersona() {
    if (!npName.trim()) return toast('Name required', false)
    if (!isAdmin) {
      // Session-only — no API call needed
      const id = `local-${Date.now()}`
      setPersonas((p) => [...p, { id, company_id: company.id, name: npName, description: npDesc, scope: 'private', created_at: new Date().toISOString(), module_count: 0 }])
      setActiveId(id)
      setNpName(''); setNpDesc('')
      setShowNewPersona(false)
      toast('Persona created (session only — add ?key=xxx to persist)')
      return
    }
    try {
      const res = await fetch(`/api/company/${company.id}/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: npName, description: npDesc, adminKey }),
      })
      if (!res.ok) {
        const body = await res.json()
        return toast(body.error ?? 'Error', false)
      }
      const { id } = await res.json()
      setPersonas((p) => [...p, { id, company_id: company.id, name: npName, description: npDesc, scope: 'private', created_at: new Date().toISOString(), module_count: 0 }])
      setActiveId(id)
      setNpName(''); setNpDesc('')
      setShowNewPersona(false)
      toast('Persona created')
    } catch { toast('Failed', false) }
  }

  async function toggleRepoModule(repoId: string, path: string) {
    const key = `${repoId}::${path}`
    const existing = activeModules.find((m) => m.repo_id === repoId && m.path === path)

    if (existing) {
      // Remove
      try {
        await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId: existing.id, adminKey }),
        })
        setModules((m) => m.filter((x) => x.id !== existing.id))
        setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: Math.max(0, x.module_count - 1) } : x))
      } catch { toast('Failed', false) }
    } else {
      // Add from repo
      try {
        const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo_id: repoId, path, adminKey }),
        })
        if (!res.ok) return toast('Failed to add', false)
        const { id } = await res.json()
        const rm = repoModules.find((m) => m.repo_id === repoId && m.path === path)!
        const newMod: PersonaModule = {
          id, persona_id: activeId!, repo_id: repoId, path,
          type: rm.type, name: rm.name, description: rm.description,
          tokens: rm.tokens, enabled: true, content: rm.content,
        }
        setModules((m) => [...m, newMod])
        setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: x.module_count + 1 } : x))
      } catch { toast('Failed', false) }
    }
  }

  async function addAllFromRepo(repoId: string) {
    const toAdd = repoModules.filter((m) => m.repo_id === repoId && !activeModuleKeys.has(`${m.repo_id}::${m.path}`))
    for (const rm of toAdd) await toggleRepoModule(repoId, rm.path)
    toast(`Added ${toAdd.length} module${toAdd.length !== 1 ? 's' : ''}` + (!isAdmin ? ' (session only)' : ''))
  }

  async function addManualModule() {
    if (!nmName.trim() || !activeId) return toast('Name required', false)
    try {
      const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nmName, type: nmType, description: nmDesc, content: nmContent, tokens: nmTokens ? parseInt(nmTokens) : null, adminKey }),
      })
      if (!res.ok) return toast('Failed to save', false)
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
      setView('detail')
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

  const repoNameMap = Object.fromEntries(repos.map((r) => [r.id, r.name]))

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="flex flex-col border-r flex-shrink-0" style={{ width: 240, background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10px] font-medium tracking-[.14em] uppercase" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>Personas</span>
          <button onClick={() => setShowNewPersona((v) => !v)}
            className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}>
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {personas.map((p) => (
            <div key={p.id} onClick={() => { setActiveId(p.id); setView('detail') }}
              className="flex items-center gap-2 px-5 py-3 cursor-pointer border-l-2 transition-all"
              style={{ background: p.id === activeId ? 'var(--teal-soft)' : 'transparent', borderLeftColor: p.id === activeId ? 'var(--teal)' : 'transparent' }}>
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

        {showNewPersona && (
          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <p className="text-[10px] font-medium tracking-[.12em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>New Persona</p>
            <input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="Name"
              className="w-full text-xs px-3 py-2 rounded-lg border mb-2 outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <textarea value={npDesc} onChange={(e) => setNpDesc(e.target.value)} placeholder="Description"
              className="w-full text-xs px-3 py-2 rounded-lg border mb-2 outline-none resize-none" rows={2}
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }} />
            <div className="flex gap-2">
              <button onClick={createPersona} className="flex-1 text-xs py-1.5 rounded-lg font-semibold text-white" style={{ background: 'var(--teal)' }}>Create</button>
              <button onClick={() => setShowNewPersona(false)} className="flex-1 text-xs py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!activePersona ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--ink-4)' }}>
            <p className="text-sm">Select a persona or create a new one.</p>
          </div>
        ) : view === 'picker' ? (
          // ── Module Picker (lattice-style) ──
          <div className="flex flex-col h-full">
            <div className="bg-white border-b px-8 py-4 flex items-center gap-4 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setView('detail')} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>
                ← Back
              </button>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--indigo)' }}>Add Modules — {activePersona.name}</h2>
            </div>
            <div className="flex flex-1 overflow-hidden">
              {/* Repo list */}
              <div className="border-r overflow-y-auto flex-shrink-0" style={{ width: 220, borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {repos.length === 0 && (
                  <p className="px-5 py-4 text-xs" style={{ color: 'var(--ink-4)' }}>No repos. Add one in Marketplace.</p>
                )}
                {repos.map((r) => (
                  <div key={r.id} onClick={() => setPickerRepoId(r.id)}
                    className="px-5 py-3 cursor-pointer border-l-2 transition-all"
                    style={{ background: pickerRepoId === r.id ? 'var(--teal-soft)' : 'transparent', borderLeftColor: pickerRepoId === r.id ? 'var(--teal)' : 'transparent' }}>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{r.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                      {repoModules.filter((m) => m.repo_id === r.id).length} modules
                    </div>
                  </div>
                ))}
              </div>

              {/* Module checklist */}
              <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: 'var(--bg)' }}>
                {pickerRepoId && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                        {repoNameMap[pickerRepoId] ?? pickerRepoId}
                      </h3>
                      <button onClick={() => addAllFromRepo(pickerRepoId)}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold text-white"
                        style={{ background: 'var(--teal)' }}>
                        Add All
                      </button>
                    </div>
                    <div className="space-y-2">
                      {pickerRepoModules.map((m) => {
                        const checked = activeModuleKeys.has(`${m.repo_id}::${m.path}`)
                        return (
                          <div key={m.id}
                            onClick={() => toggleRepoModule(m.repo_id, m.path)}
                            className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none"
                            style={{
                              background: checked ? 'var(--teal-softer)' : 'var(--surface)',
                              borderColor: checked ? 'var(--teal)' : 'var(--border)',
                            }}>
                            <input type="checkbox" checked={checked} readOnly
                              onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0"
                              style={{ accentColor: 'var(--teal)', width: 15, height: 15 }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full`}
                                  style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                                  {m.type}
                                </span>
                                <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{m.name}</span>
                              </div>
                              {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                              {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                            </div>
                          </div>
                        )
                      })}
                      {pickerRepoModules.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No modules in this repository.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : view === 'manual' ? (
          // ── Manual module form ──
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="bg-white border-b px-8 py-4 flex items-center gap-4 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setView('detail')} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>
                ← Back
              </button>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--indigo)' }}>Custom Module — {activePersona.name}</h2>
            </div>
            <div className="px-8 py-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={nmName} onChange={(e) => setNmName(e.target.value)} placeholder="Name *"
                  className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <select value={nmType} onChange={(e) => setNmType(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
                  <option value="skill">skill</option>
                  <option value="blueprint">blueprint</option>
                  <option value="agent">agent</option>
                  <option value="command">command</option>
                </select>
                <input value={nmTokens} onChange={(e) => setNmTokens(e.target.value)} placeholder="Tokens (est.)" type="number"
                  className="text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <input value={nmDesc} onChange={(e) => setNmDesc(e.target.value)} placeholder="Description"
                  className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              </div>
              <textarea value={nmContent} onChange={(e) => setNmContent(e.target.value)}
                placeholder="Module content (Markdown) — instructions for the agent..."
                className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y mb-3"
                rows={10}
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
              <div className="flex gap-2">
                <button onClick={addManualModule} className="text-sm px-5 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Add Module</button>
                <button onClick={() => setView('detail')} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          // ── Persona detail ──
          <div className="flex flex-col h-full">
            <div className="bg-white border-b px-8 py-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>{activePersona.name}</h2>
                  {activePersona.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>{activePersona.description}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  {repos.length > 0 && (
                    <button onClick={() => setView('picker')}
                      className="text-xs px-4 py-2 rounded-full font-semibold text-white"
                      style={{ background: 'var(--teal)' }}>
                      + Add from Repo
                    </button>
                  )}
                  <button onClick={() => setView('manual')}
                    className="text-xs px-4 py-2 rounded-full font-medium border"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>
                    + Custom Module
                  </button>
                </div>
              </div>
              {!isAdmin && (
                <p className="text-xs mt-2" style={{ color: 'var(--warn)' }}>
                  Add <code className="px-1 rounded" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}>?key=xxx</code> to the URL to persist changes.
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5">
              {activeModules.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
                  No modules yet.{repos.length > 0 ? ' Click "+ Add from Repo" to add skills or blueprints.' : ' Click "+ Custom Module" to author one.'}
                </p>
              )}

              {/* Modules grouped by repo */}
              {Object.entries(groupedModules).map(([key, mods]) => (
                <div key={key} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-medium tracking-[.12em] uppercase px-2"
                      style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                      {key === 'custom' ? 'Custom' : (repoNameMap[key] ?? key)}
                    </span>
                    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  </div>
                  <div className="space-y-2">
                    {mods.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 p-4 rounded-xl border bg-white"
                        style={{ borderColor: 'var(--border)', boxShadow: 'var(--sh)' }}>
                        <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5`}
                          style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                          {m.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</div>
                          {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                          {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                          {m.content && (
                            <pre className="mt-2 text-[11px] p-2 rounded-lg overflow-hidden max-h-20 leading-relaxed"
                              style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface-2)', color: 'var(--ink-3)', border: '1px solid var(--border-2)' }}>
                              {m.content.slice(0, 300)}{m.content.length > 300 ? '…' : ''}
                            </pre>
                          )}
                        </div>
                        <button onClick={() => removeModule(m.id)}
                          className="text-xs px-2 py-1 rounded flex-shrink-0 transition-colors"
                          style={{ color: 'var(--ink-4)', background: 'transparent' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = '#fef2f2' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
