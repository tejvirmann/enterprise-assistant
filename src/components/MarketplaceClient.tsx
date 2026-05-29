'use client'

import { useState, useMemo } from 'react'
import type { Company, Repo, RepoModule } from '@/lib/types'

const SYSTEM_META: Record<string, { label: string; description: string; owner: string }> = {
  lims:    { label: 'LIMS',    description: 'Lab Information Management — samples, assays, OOS, instruments', owner: 'MadStack' },
  qms:     { label: 'QMS',     description: 'Quality Management — batches, deviations, CAPAs, specifications', owner: 'MadStack' },
  rosetta: { label: 'Rosetta', description: 'Data Normalization — term mappings, unit conversions, compound aliases', owner: 'MadStack' },
}

const TYPE_COLORS: Record<string, string> = {
  skill:     'bg-[#e6f1ef] text-[#15716a]',
  blueprint: 'bg-purple-50 text-purple-700',
  agent:     'bg-green-50 text-green-700',
  command:   'bg-amber-50 text-amber-700',
}

interface PersonaStub { id: string; name: string }

interface Props {
  company: Company
  enabledTools: string[]
  toolGroups: Record<string, { toolId: string; description: string }[]>
  repos: Repo[]
  repoModules: RepoModule[]
  personas: PersonaStub[]
  isAdmin: boolean
  adminKey: string | null
}

function toast(msg: string, ok = true) {
  const el = document.createElement('div')
  el.textContent = msg
  el.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(15,26,26,.12);${ok ? 'background:#e6f1ef;color:#15716a;border:1px solid rgba(54,153,150,.3)' : 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca'}`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

export function MarketplaceClient({ company, enabledTools: initial, toolGroups, repos: initialRepos, repoModules, personas, isAdmin, adminKey }: Props) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initial))
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())
  const [repos, setRepos] = useState<Repo[]>(initialRepos)
  const [query, setQuery] = useState('')
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [repoName, setRepoName] = useState('')
  const [repoDesc, setRepoDesc] = useState('')

  // Custom module form
  const [showCustomModule, setShowCustomModule] = useState(false)
  const [cmPersonaId, setCmPersonaId] = useState(personas[0]?.id ?? '')
  const [cmName, setCmName] = useState('')
  const [cmType, setCmType] = useState('skill')
  const [cmDesc, setCmDesc] = useState('')
  const [cmContent, setCmContent] = useState('')
  const [cmTokens, setCmTokens] = useState('')

  const q = query.toLowerCase()

  // Filtered tool prefixes
  const filteredPrefixes = useMemo(() => {
    const prefixes = Object.keys(toolGroups)
    if (!q) return prefixes
    return prefixes.filter((prefix) => {
      const meta = SYSTEM_META[prefix]
      if (`${meta?.label} ${meta?.description}`.toLowerCase().includes(q)) return true
      return (toolGroups[prefix] ?? []).some((t) => t.toolId.includes(q) || t.description.toLowerCase().includes(q))
    })
  }, [q, toolGroups])

  // Filtered repos
  const filteredRepos = useMemo(() => {
    if (!q) return repos
    return repos.filter((r) => {
      if (`${r.name} ${r.description ?? ''}`.toLowerCase().includes(q)) return true
      return repoModules.filter((m) => m.repo_id === r.id).some((m) =>
        `${m.name} ${m.description ?? ''} ${m.type}`.toLowerCase().includes(q)
      )
    })
  }, [q, repos, repoModules])

  async function toggleServer(prefix: string) {
    const serverTools = (toolGroups[prefix] ?? []).map((t) => t.toolId)
    const allOn = serverTools.every((id) => enabled.has(id))
    const next = new Set(enabled)
    for (const id of serverTools) allOn ? next.delete(id) : next.add(id)
    if (isAdmin && adminKey) {
      try {
        await Promise.all(serverTools.map((toolId) =>
          fetch(`/api/company/${company.id}/tools`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolId, enabled: !allOn, adminKey }),
          })
        ))
        toast(allOn ? `${prefix.toUpperCase()} disabled` : `${prefix.toUpperCase()} enabled`)
      } catch { toast('Failed to save', false); return }
    } else {
      toast('Session only — add ?key=xxx to persist', false)
    }
    setEnabled(next)
  }

  async function addRepoToPersona(repoId: string, personaId: string, modules: RepoModule[]) {
    for (const m of modules) {
      await fetch(`/api/company/${company.id}/personas/${personaId}/modules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, path: m.path, adminKey }),
      })
    }
    toast(`Added ${modules.length} module${modules.length !== 1 ? 's' : ''}` + (!isAdmin ? ' (session only)' : ''))
  }

  async function addModuleToPersona(repoId: string, path: string, personaId: string) {
    const res = await fetch(`/api/company/${company.id}/personas/${personaId}/modules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_id: repoId, path, adminKey }),
    })
    if (!res.ok) { toast('Failed', false); return }
    toast('Module added' + (!isAdmin ? ' (session only)' : ''))
  }

  async function addCustomModule() {
    if (!cmName.trim()) return toast('Name required', false)
    if (!cmPersonaId) return toast('Select a persona', false)
    const res = await fetch(`/api/company/${company.id}/personas/${cmPersonaId}/modules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cmName, type: cmType, description: cmDesc, content: cmContent, tokens: cmTokens ? parseInt(cmTokens) : null, adminKey }),
    })
    if (!res.ok) { toast('Failed', false); return }
    setCmName(''); setCmType('skill'); setCmDesc(''); setCmContent(''); setCmTokens('')
    setShowCustomModule(false)
    toast('Module created' + (!isAdmin ? ' (session only)' : ''))
  }

  async function addRepo() {
    if (!repoName.trim()) return toast('Name required', false)
    const res = await fetch(`/api/company/${company.id}/repos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: repoName, description: repoDesc, repo_url: repoUrl, adminKey }),
    })
    if (!res.ok) { toast(!isAdmin ? 'Add ?key=xxx to persist' : 'Failed', false); return }
    const { id } = await res.json()
    setRepos((r) => [...r, { id, name: repoName, description: repoDesc || null, repo_url: repoUrl || null, owner: null, scope: 'private', verified: false, module_count: 0 }])
    setRepoName(''); setRepoDesc(''); setRepoUrl('')
    setShowAddRepo(false)
    toast('Repository added')
  }

  async function removeRepo(repoId: string) {
    await fetch(`/api/company/${company.id}/repos`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId, adminKey }),
    })
    setRepos((r) => r.filter((x) => x.id !== repoId))
    toast('Removed')
  }

  const prefixes = filteredPrefixes

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="bg-white border-b px-8 py-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>Marketplace</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-3)' }}>
              MCP tool servers and context repositories for {company.name}.
              {!isAdmin && <span className="ml-2 font-medium" style={{ color: 'var(--warn)' }}>
                Add <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}>?key=xxx</code> to save.
              </span>}
            </p>
          </div>
          <button onClick={() => setShowCustomModule((v) => !v)}
            className="flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium border transition-colors"
            style={{ borderColor: 'var(--teal)', color: 'var(--teal-ink)', background: 'var(--teal-softer)' }}>
            + Custom Module
          </button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--ink-4)' }}>⌕</span>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, repos, modules…"
            className="w-full text-sm pl-8 pr-4 py-2 rounded-xl border outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
        </div>
      </div>

      {/* Custom Module form (inline panel) */}
      {showCustomModule && (
        <div className="px-8 pt-5">
          <div className="rounded-xl border p-5 bg-white" style={{ borderColor: 'var(--teal)', boxShadow: 'var(--sh)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--teal)' }}>Custom Module</p>
              <button onClick={() => setShowCustomModule(false)} className="text-xs" style={{ color: 'var(--ink-4)' }}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input value={cmName} onChange={(e) => setCmName(e.target.value)} placeholder="Name *"
                className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              <select value={cmPersonaId} onChange={(e) => setCmPersonaId(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={cmType} onChange={(e) => setCmType(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}>
                <option value="skill">skill</option>
                <option value="blueprint">blueprint</option>
                <option value="agent">agent</option>
                <option value="command">command</option>
              </select>
              <input value={cmDesc} onChange={(e) => setCmDesc(e.target.value)} placeholder="Description"
                className="text-sm px-3 py-2 rounded-lg border outline-none col-span-2" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              <input value={cmTokens} onChange={(e) => setCmTokens(e.target.value)} placeholder="Tokens (est.)" type="number"
                className="text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
            </div>
            <textarea value={cmContent} onChange={(e) => setCmContent(e.target.value)}
              placeholder="Module content (Markdown instructions for the agent)…"
              className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-y mb-3"
              rows={6} style={{ borderColor: 'var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
            <div className="flex gap-2">
              <button onClick={addCustomModule} className="text-sm px-5 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Create</button>
              <button onClick={() => setShowCustomModule(false)} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6 max-w-4xl space-y-10">

        {/* MCP Tool Servers */}
        <div>
          <p className="text-[10px] font-medium tracking-[.14em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>
            MCP Tool Servers
          </p>
          {prefixes.length === 0 && <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No results.</p>}
          <div className="space-y-3">
            {prefixes.map((prefix) => {
              const meta = SYSTEM_META[prefix] ?? { label: prefix.toUpperCase(), description: 'Data system', owner: 'Unknown' }
              const tools = toolGroups[prefix] ?? []
              const allOn = tools.every((t) => enabled.has(t.toolId))
              const isExpanded = expandedTools.has(prefix)
              const filteredTools = q ? tools.filter((t) => t.toolId.includes(q) || t.description.toLowerCase().includes(q)) : tools

              return (
                <div key={prefix} className="rounded-xl border bg-white overflow-hidden"
                  style={{ borderColor: allOn ? 'var(--teal)' : 'var(--border)', boxShadow: 'var(--sh)' }}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{meta.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--teal-soft)', color: 'var(--teal-ink)' }}>
                          {tools.length} tools
                        </span>
                        {allOn && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: '#dcfce7', color: '#166534' }}>✓ Enabled</span>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{meta.description}</p>
                      <p className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>by {meta.owner}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedTools((p) => { const n = new Set(p); n.has(prefix) ? n.delete(prefix) : n.add(prefix); return n })}
                        className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}>
                        {isExpanded ? 'Hide' : 'View tools'}
                      </button>
                      <button onClick={() => toggleServer(prefix)}
                        className="text-xs px-4 py-1.5 rounded-full font-semibold text-white"
                        style={{ background: allOn ? 'var(--ink-3)' : 'var(--teal)' }}>
                        {allOn ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-5 py-3 space-y-2" style={{ borderColor: 'var(--border-2)', background: 'var(--teal-softer)' }}>
                      {filteredTools.map((t) => (
                        <div key={t.toolId} className="flex items-start gap-3">
                          <code className="text-[11px] px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface)', border: '1px solid var(--teal-soft)', color: 'var(--teal-ink)' }}>
                            {t.toolId.slice(prefix.length + 1)}
                          </code>
                          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{t.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Context Repositories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-medium tracking-[.14em] uppercase" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>
              Context Repositories
            </p>
            <button onClick={() => setShowAddRepo((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}>
              + Add Repo
            </button>
          </div>

          {showAddRepo && (
            <div className="rounded-xl border p-5 mb-4 bg-white" style={{ borderColor: 'var(--teal)', boxShadow: 'var(--sh)' }}>
              <p className="text-[10px] font-medium tracking-[.12em] uppercase mb-3" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--teal)' }}>Add Repository</p>
              <div className="space-y-2">
                <input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="Name *"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="GitHub URL (optional)"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
                <input value={repoDesc} onChange={(e) => setRepoDesc(e.target.value)} placeholder="Description"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none" style={{ borderColor: 'var(--border)', color: 'var(--ink)' }} />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addRepo} className="text-sm px-5 py-2 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>Add</button>
                <button onClick={() => setShowAddRepo(false)} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)' }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filteredRepos.length === 0 && !showAddRepo && (
              <p className="text-sm py-2" style={{ color: 'var(--ink-4)' }}>{q ? 'No repos match your search.' : 'No repositories added yet.'}</p>
            )}
            {filteredRepos.map((r) => {
              const mods = repoModules.filter((m) => m.repo_id === r.id)
              const filteredMods = q ? mods.filter((m) => `${m.name} ${m.description ?? ''} ${m.type}`.toLowerCase().includes(q)) : mods
              const isExpanded = expandedRepos.has(r.id)

              return (
                <div key={r.id} className="rounded-xl border bg-white overflow-hidden"
                  style={{ borderColor: 'var(--teal)', boxShadow: 'var(--sh)' }}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{r.name}</span>
                        {r.verified && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: '#dcfce7', color: '#166534' }}>✓ Verified</span>}
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--teal-soft)', color: 'var(--teal-ink)' }}>
                          {mods.length} modules
                        </span>
                      </div>
                      {r.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{r.description}</p>}
                      {r.repo_url && <p className="text-[10px] mt-0.5 truncate" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>{r.repo_url}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedRepos((p) => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                        className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}>
                        {isExpanded ? 'Hide' : 'Browse'}
                      </button>
                      {personas.length > 0 && isExpanded && (
                        <button onClick={() => addRepoToPersona(r.id, personas[0].id, mods)}
                          className="text-xs px-3 py-1.5 rounded-full font-semibold text-white" style={{ background: 'var(--teal)' }}>
                          Add All → {personas[0].name}
                        </button>
                      )}
                      <button onClick={() => removeRepo(r.id)}
                        className="text-xs px-2 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = '#fecaca' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                        ✕
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t" style={{ borderColor: 'var(--border-2)', background: 'var(--teal-softer)' }}>
                      {filteredMods.length === 0 && <p className="px-5 py-3 text-xs" style={{ color: 'var(--ink-4)' }}>No modules found.</p>}
                      {filteredMods.map((m) => (
                        <div key={m.id} className="px-5 py-3 border-b last:border-b-0 flex items-start gap-3"
                          style={{ borderColor: 'var(--border)' }}>
                          <span className={`${TYPE_COLORS[m.type] ?? 'bg-slate-100 text-slate-600'} text-[9px] font-medium tracking-[.06em] uppercase px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5`}
                            style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                            {m.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{m.name}</div>
                            {m.description && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{m.description}</p>}
                            {m.tokens && <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>~{m.tokens.toLocaleString()} tokens</span>}
                            {m.content && (
                              <pre className="mt-1.5 text-[11px] p-2 rounded-lg overflow-hidden max-h-16"
                                style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface)', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
                                {m.content.slice(0, 200)}{m.content.length > 200 ? '…' : ''}
                              </pre>
                            )}
                          </div>
                          {personas.length > 0 && (
                            <div className="flex gap-1 flex-shrink-0 mt-0.5">
                              {personas.slice(0, 3).map((p) => (
                                <button key={p.id} onClick={() => addModuleToPersona(r.id, m.path, p.id)}
                                  className="text-[10px] px-2 py-1 rounded-full font-medium text-white whitespace-nowrap"
                                  style={{ background: 'var(--teal)' }}>
                                  + {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
