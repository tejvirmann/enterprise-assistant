'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Company, Persona, PersonaModule, Repo, RepoModule } from '@/lib/types'

type SourcedModule = PersonaModule & { source: 'preset' | 'company' }

interface Props {
  company: Company & { admin_key?: string }
  personas: (Persona & { module_count: number })[]
  modules: SourcedModule[]
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
  context:   'bg-slate-100 text-slate-600',
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
  const router = useRouter()
  const [personas, setPersonas] = useState(initial)
  const [modules, setModules] = useState(initialModules)
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null)
  const [view, setView] = useState<View>('detail')
  const [showNewPersona, setShowNewPersona] = useState(false)
  const [pickerRepoId, setPickerRepoId] = useState<string | null>(repos[0]?.id ?? null)
  const [defaultPersonaId, setDefaultPersonaId] = useState(company.default_persona_id)

  // New persona form
  const [npName, setNpName] = useState('')
  const [npDesc, setNpDesc] = useState('')

  // Inline module editor
  const [editingModuleId, setEditingModuleId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editPrompts, setEditPrompts] = useState('')

  // Manual module form
  const [nmName, setNmName] = useState('')
  const [nmType, setNmType] = useState('skill')
  const [nmDesc, setNmDesc] = useState('')
  const [nmContent, setNmContent] = useState('')
  const [nmTokens, setNmTokens] = useState('')
  const [nmPrompts, setNmPrompts] = useState('')

  const activePersona = personas.find((p) => p.id === activeId) ?? null
  const activeModules = modules.filter((m) => m.persona_id === activeId)
  const groupedModules = activeModules.reduce<Record<string, SourcedModule[]>>((acc, m) => {
    const key = m.repo_id ?? 'custom'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})
  const pickerRepoModules = repoModules.filter((m) => m.repo_id === pickerRepoId)
  const activeModuleKeys = new Set(activeModules.map((m) => `${m.repo_id}::${m.path}`))
  const repoNameMap = Object.fromEntries(repos.map((r) => [r.id, r.name]))

  async function createPersona() {
    if (!npName.trim()) return toast('Name required', false)
    if (!isAdmin) {
      const id = `local-${Date.now()}`
      setPersonas((p) => [...p, { id, company_id: company.id, name: npName, description: npDesc || null, created_at: new Date().toISOString(), module_count: 0 }])
      setActiveId(id)
      setNpName(''); setNpDesc('')
      setShowNewPersona(false)
      toast('Persona created (session only — add ?key=xxx to persist)')
      return
    }
    const res = await fetch(`/api/company/${company.id}/personas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: npName, description: npDesc, adminKey }),
    })
    if (!res.ok) { const b = await res.json(); return toast(b.error ?? 'Error', false) }
    const { id } = await res.json()
    setPersonas((p) => [...p, { id, company_id: company.id, name: npName, description: npDesc || null, created_at: new Date().toISOString(), module_count: 0 }])
    setActiveId(id)
    setNpName(''); setNpDesc('')
    setShowNewPersona(false)
    toast('Persona created')
  }

  async function deletePersona(personaId: string) {
    if (!isAdmin) return toast('Admin key required to delete permanently', false)
    if (personas.length <= 1) return toast('Cannot delete the only persona', false)
    if (!confirm(`Delete ${personas.find(p => p.id === personaId)?.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/company/${company.id}/personas/${personaId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey }),
    })
    if (!res.ok) { const b = await res.json(); return toast(b.error ?? 'Failed', false) }
    setPersonas((p) => p.filter((x) => x.id !== personaId))
    setModules((m) => m.filter((x) => x.persona_id !== personaId))
    if (activeId === personaId) setActiveId(personas.find((p) => p.id !== personaId)?.id ?? null)
    toast('Persona deleted')
    router.refresh()
  }

  async function setDefaultPersona(personaId: string) {
    if (!isAdmin) return toast('Admin key required', false)
    const res = await fetch(`/api/company/${company.id}/personas/${personaId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, set_default: true }),
    })
    if (!res.ok) return toast('Failed', false)
    setDefaultPersonaId(personaId)
    toast('Default persona updated')
    router.refresh()
  }

  function startEdit(m: SourcedModule) {
    if (m.source === 'preset') return toast('Edit this module in /admin — it comes from the company\'s preset', false)
    setEditingModuleId(m.id)
    setEditName(m.name)
    setEditDesc(m.description ?? '')
    setEditContent(m.content ?? '')
    setEditPrompts((m.example_prompts ?? []).join('\n'))
  }

  async function saveEdit() {
    if (!editingModuleId || !activeId) return
    if (!isAdmin) return toast('Admin key required to save', false)
    const example_prompts = editPrompts.split('\n').map((s) => s.trim()).filter(Boolean)
    const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: editingModuleId, name: editName, description: editDesc, content: editContent, example_prompts, adminKey }),
    })
    if (!res.ok) return toast(res.status === 403 ? 'Admin key required' : 'Failed to save', false)
    setModules((mods) => mods.map((m) =>
      m.id === editingModuleId ? { ...m, name: editName, description: editDesc || null, content: editContent || null, example_prompts } : m
    ))
    setEditingModuleId(null)
    toast('Module saved')
    router.refresh()
  }

  async function toggleRepoModule(repoId: string, path: string) {
    if (!isAdmin) return toast('Admin key required', false)
    const existing = activeModules.find((m) => m.repo_id === repoId && m.path === path)
    if (existing) {
      const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: existing.id, adminKey }),
      })
      if (!res.ok) return toast(res.status === 403 ? 'Admin key required' : 'Failed to remove', false)
      setModules((m) => m.filter((x) => x.id !== existing.id))
      setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: Math.max(0, x.module_count - 1) } : x))
    } else {
      const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, path, adminKey }),
      })
      if (!res.ok) return toast(res.status === 403 ? 'Admin key required' : 'Failed to add', false)
      const { id } = await res.json()
      const rm = repoModules.find((m) => m.repo_id === repoId && m.path === path)!
      setModules((m) => [...m, { id, persona_id: activeId!, repo_id: repoId, path, type: rm.type, name: rm.name, description: rm.description, tokens: rm.tokens, enabled: true, content: rm.content, example_prompts: [], source: 'company' }])
      setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: x.module_count + 1 } : x))
    }
  }

  async function addAllFromRepo(repoId: string) {
    const toAdd = repoModules.filter((m) => m.repo_id === repoId && !activeModuleKeys.has(`${m.repo_id}::${m.path}`))
    for (const rm of toAdd) await toggleRepoModule(repoId, rm.path)
    toast(`Added ${toAdd.length} modules` + (!isAdmin ? ' (session only)' : ''))
  }

  async function addManualModule() {
    if (!nmName.trim() || !activeId) return toast('Name required', false)
    if (!isAdmin) return toast('Add ?key=xxx to the URL to create a module', false)
    const example_prompts = nmPrompts.split('\n').map((s) => s.trim()).filter(Boolean)
    const res = await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nmName, type: nmType, description: nmDesc, content: nmContent, tokens: nmTokens ? parseInt(nmTokens) : null, example_prompts, adminKey }),
    })
    if (!res.ok) return toast('Failed to add module', false)
    const { id } = await res.json()
    setModules((m) => [...m, { id, persona_id: activeId, repo_id: null, path: null, type: nmType, name: nmName, description: nmDesc || null, tokens: nmTokens ? parseInt(nmTokens) : null, enabled: true, content: nmContent || null, example_prompts, source: 'company' }])
    setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: x.module_count + 1 } : x))
    setNmName(''); setNmType('skill'); setNmDesc(''); setNmContent(''); setNmTokens(''); setNmPrompts('')
    setView('detail')
    toast('Module added')
    router.refresh()
  }

  async function removeModule(m: SourcedModule) {
    if (!isAdmin) return toast('Admin key required', false)
    if (m.source === 'preset') {
      if (!confirm('This module comes from the company\'s preset. Excluding it only affects this company — manage the preset itself in /admin. Continue?')) return
      await fetch(`/api/company/${company.id}/preset-exclusions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'module', ref_id: m.id, adminKey }),
      })
      setModules((mods) => mods.filter((x) => x !== m))
      toast('Excluded for this company')
      return
    }
    await fetch(`/api/company/${company.id}/personas/${activeId}/modules`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: m.id, adminKey }),
    })
    setModules((mods) => mods.filter((x) => x.id !== m.id))
    setPersonas((p) => p.map((x) => x.id === activeId ? { ...x, module_count: Math.max(0, x.module_count - 1) } : x))
    toast('Removed')
    router.refresh()
  }

  // suppress unused warning for useCallback import
  void useCallback

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
            <div key={p.id}
              className="group flex items-center gap-2 px-4 py-3 cursor-pointer border-l-2 transition-all"
              style={{ background: p.id === activeId ? 'var(--teal-soft)' : 'transparent', borderLeftColor: p.id === activeId ? 'var(--teal)' : 'transparent' }}
              onClick={() => { setActiveId(p.id); setView('detail') }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{p.name}</span>
                  {p.id === defaultPersonaId && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--teal)' }} title="Default persona">★</span>
                  )}
                </div>
                <div className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                  {p.module_count} module{p.module_count !== 1 ? 's' : ''}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {p.id !== defaultPersonaId && (
                    <button onClick={(e) => { e.stopPropagation(); setDefaultPersona(p.id) }}
                      className="text-[11px] w-6 h-6 flex items-center justify-center rounded transition-colors"
                      title="Set as default"
                      style={{ color: 'var(--ink-4)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--teal)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-4)')}>
                      ★
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); deletePersona(p.id) }}
                    className="text-[11px] w-6 h-6 flex items-center justify-center rounded transition-colors"
                    title="Delete persona"
                    style={{ color: 'var(--ink-4)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-4)')}>
                    ✕
                  </button>
                </div>
              )}
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
          <div className="flex flex-col h-full">
            <div className="bg-white border-b px-8 py-4 flex items-center gap-4 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setView('detail')} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>← Back</button>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--indigo)' }}>Add Modules — {activePersona.name}</h2>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="border-r overflow-y-auto flex-shrink-0" style={{ width: 220, borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {repos.length === 0 && <p className="px-5 py-4 text-xs" style={{ color: 'var(--ink-4)' }}>No repos. Add one in Marketplace.</p>}
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
              <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: 'var(--bg)' }}>
                {pickerRepoId && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>{repoNameMap[pickerRepoId] ?? pickerRepoId}</h3>
                      <button onClick={() => addAllFromRepo(pickerRepoId)} className="text-xs px-3 py-1.5 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Add All</button>
                    </div>
                    <div className="space-y-2">
                      {pickerRepoModules.map((m) => {
                        const checked = activeModuleKeys.has(`${m.repo_id}::${m.path}`)
                        return (
                          <div key={m.id} onClick={() => toggleRepoModule(m.repo_id, m.path)}
                            className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none"
                            style={{ background: checked ? 'var(--teal-softer)' : 'var(--surface)', borderColor: checked ? 'var(--teal)' : 'var(--border)' }}>
                            <input type="checkbox" checked={checked} readOnly onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0" style={{ accentColor: 'var(--teal)', width: 15, height: 15 }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full`} style={{ fontFamily: 'var(--font-mono, monospace)' }}>{m.type}</span>
                                <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{m.name}</span>
                              </div>
                              {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                              {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                            </div>
                          </div>
                        )
                      })}
                      {pickerRepoModules.length === 0 && <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No modules in this repository.</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : view === 'manual' ? (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="bg-white border-b px-8 py-4 flex items-center gap-4 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setView('detail')} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>← Back</button>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--indigo)' }}>Custom Module — {activePersona.name}</h2>
            </div>
            <div className="px-8 py-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={nmName} onChange={(e) => setNmName(e.target.value)} placeholder="Name *"
                  className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <select value={nmType} onChange={(e) => setNmType(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
                  <option value="skill">skill</option>
                  <option value="blueprint">blueprint</option>
                  <option value="context">context</option>
                  <option value="command">command</option>
                </select>
                <input value={nmTokens} onChange={(e) => setNmTokens(e.target.value)} placeholder="Tokens (est.)" type="number"
                  className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <input value={nmDesc} onChange={(e) => setNmDesc(e.target.value)} placeholder="Description"
                  className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              </div>
              <textarea value={nmContent} onChange={(e) => setNmContent(e.target.value)}
                placeholder="Module content (Markdown) — instructions the agent will follow…"
                className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y mb-3"
                rows={10} style={{ borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ink-3)' }}>Example prompts (one per line) — shown as chips on the chat welcome screen</label>
              <textarea value={nmPrompts} onChange={(e) => setNmPrompts(e.target.value)}
                placeholder="Compare HPLC Purity for XB-441 across all batches"
                className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y mb-3"
                rows={3} style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              <div className="flex gap-2">
                <button onClick={addManualModule} className="text-sm px-5 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Add Module</button>
                <button onClick={() => setView('detail')} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-white border-b px-8 py-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>{activePersona.name}</h2>
                    {activePersona.id === defaultPersonaId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)', border: '1px solid var(--teal-soft)', fontFamily: 'var(--font-mono, monospace)' }}>
                        ★ Default
                      </span>
                    )}
                  </div>
                  {activePersona.description && <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>{activePersona.description}</p>}
                </div>
                <div className="flex gap-2 mt-1 flex-shrink-0">
                  {repos.length > 0 && (
                    <button onClick={() => setView('picker')} className="text-xs px-4 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>
                      + Add from Repo
                    </button>
                  )}
                  <button onClick={() => setView('manual')} className="text-xs px-4 py-2 rounded-full font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>
                    + Custom Module
                  </button>
                </div>
              </div>
              {!isAdmin && <p className="text-xs mt-2" style={{ color: 'var(--warn)' }}>Add <code className="px-1 rounded" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}>?key=xxx</code> to the URL to save changes permanently.</p>}
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5">
              {activeModules.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
                  No modules yet.{repos.length > 0 ? ' Use "+ Add from Repo" to load skills or blueprints from a repository.' : ' Use "+ Custom Module" to write one.'}
                </p>
              )}
              {Object.entries(groupedModules).map(([key, mods]) => (
                <div key={key} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-medium tracking-[.12em] uppercase px-2" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>
                      {key === 'custom' ? 'Custom' : (repoNameMap[key] ?? key)}
                    </span>
                    <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  </div>
                  <div className="space-y-2">
                    {mods.map((m) => (
                      <div key={m.id} className="rounded-xl border bg-white" style={{ borderColor: editingModuleId === m.id ? 'var(--teal)' : 'var(--border)', boxShadow: 'var(--sh)' }}>
                        {editingModuleId === m.id ? (
                          <div className="p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0`} style={{ fontFamily: 'var(--font-mono, monospace)' }}>{m.type}</span>
                              <span className="text-[10px]" style={{ color: 'var(--teal-ink)', fontFamily: 'var(--font-mono, monospace)' }}>editing</span>
                            </div>
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name"
                              className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--teal)', color: 'var(--ink)' }} />
                            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description"
                              className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                              placeholder="Module content (Markdown instructions for the agent)…"
                              className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y"
                              rows={8} style={{ borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
                            <label className="text-[10px] font-medium block" style={{ color: 'var(--ink-4)' }}>Example prompts (one per line)</label>
                            <textarea value={editPrompts} onChange={(e) => setEditPrompts(e.target.value)}
                              placeholder="Compare HPLC Purity for XB-441 across all batches"
                              className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y"
                              rows={3} style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                            <div className="flex gap-2 pt-1">
                              <button onClick={saveEdit} className="text-xs px-4 py-1.5 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Save</button>
                              <button onClick={() => setEditingModuleId(null)} className="text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 p-4">
                            <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5`} style={{ fontFamily: 'var(--font-mono, monospace)' }}>{m.type}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</span>
                                {m.source === 'preset' && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: '#ede9fe', color: '#6d28d9' }}>from preset</span>
                                )}
                              </div>
                              {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                              {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                              {m.content && (
                                <pre className="mt-2 text-[11px] p-2 rounded-lg overflow-hidden max-h-20 leading-relaxed" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface-2)', color: 'var(--ink-3)', border: '1px solid var(--border-2)' }}>
                                  {m.content.slice(0, 300)}{m.content.length > 300 ? '…' : ''}
                                </pre>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => startEdit(m)}
                                className="text-[10px] px-2 py-1 rounded border transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--ink-4)', background: 'transparent' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--teal-ink)'; e.currentTarget.style.borderColor = 'var(--teal-soft)'; e.currentTarget.style.background = 'var(--teal-softer)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}>
                                Edit
                              </button>
                              <button onClick={() => removeModule(m)}
                                className="text-[10px] px-2 py-1 rounded transition-colors"
                                style={{ color: 'var(--ink-4)', background: 'transparent' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}>
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
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
