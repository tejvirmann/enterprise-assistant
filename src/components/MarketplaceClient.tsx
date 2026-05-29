'use client'

import { useState } from 'react'
import { ALL_TOOLS } from '@/tools/index'
import type { Company } from '@/lib/types'

const SYSTEM_META: Record<string, { label: string; description: string; owner: string }> = {
  lims:    { label: 'LIMS',    description: 'Lab Information Management — samples, assays, OOS, instruments', owner: 'MadStack' },
  qms:     { label: 'QMS',     description: 'Quality Management — batches, deviations, CAPAs, specifications', owner: 'MadStack' },
  rosetta: { label: 'Rosetta', description: 'Data Normalization — term mappings, unit conversions, compound aliases', owner: 'MadStack' },
}

function groupTools() {
  const groups: Record<string, { toolId: string; description: string }[]> = {}
  for (const [toolId, tool] of Object.entries(ALL_TOOLS)) {
    const prefix = toolId.split('_')[0]
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push({ toolId, description: (tool as { description?: string }).description ?? '' })
  }
  return groups
}

interface Props {
  company: Company
  enabledTools: string[]
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

export function MarketplaceClient({ company, enabledTools: initial, isAdmin, adminKey }: Props) {
  const groups = groupTools()
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initial))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function toggleServer(prefix: string) {
    const serverTools = Object.keys(groups[prefix] ? groups : {})
      .filter(() => true)
      .flatMap(() => (groups[prefix] ?? []).map((t) => t.toolId))

    const allOn = serverTools.every((id) => enabled.has(id))
    const next = new Set(enabled)
    for (const id of serverTools) {
      allOn ? next.delete(id) : next.add(id)
    }

    if (isAdmin && adminKey) {
      try {
        await Promise.all(
          serverTools.map((toolId) =>
            fetch(`/api/company/${company.id}/tools`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ toolId, enabled: !allOn, adminKey }),
            })
          )
        )
        toast(allOn ? `${prefix.toUpperCase()} disabled` : `${prefix.toUpperCase()} enabled`)
      } catch {
        toast('Failed to save', false)
        return
      }
    } else {
      toast(isAdmin ? 'Saved (session only — no key)' : 'Session only — provide ?key=xxx to persist', !isAdmin)
    }
    setEnabled(next)
  }

  function toggleExpand(prefix: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(prefix) ? next.delete(prefix) : next.add(prefix)
      return next
    })
  }

  const prefixes = Object.keys(groups)

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      {/* Page header */}
      <div className="bg-white border-b px-8 py-6" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>Marketplace</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
          Browse available MCP tool servers and enable them for {company.name}.
          {!isAdmin && (
            <span className="ml-2 font-medium" style={{ color: 'var(--warn)' }}>
              Add <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}>?key=xxx</code> to the URL to save changes.
            </span>
          )}
        </p>
      </div>

      <div className="px-8 py-6 max-w-4xl">

        {/* MCP Tool Servers */}
        <div className="mb-2">
          <p className="text-[10px] font-medium tracking-[.14em] uppercase mb-4" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-3)' }}>
            MCP Tool Servers
          </p>
          <div className="space-y-3">
            {prefixes.map((prefix) => {
              const meta = SYSTEM_META[prefix] ?? { label: prefix.toUpperCase(), description: 'Data system', owner: 'Unknown' }
              const tools = groups[prefix] ?? []
              const allOn = tools.every((t) => enabled.has(t.toolId))
              const isExpanded = expanded.has(prefix)

              return (
                <div
                  key={prefix}
                  className="rounded-xl border bg-white overflow-hidden"
                  style={{ borderColor: allOn ? 'var(--teal)' : 'var(--border)', boxShadow: 'var(--sh)' }}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{meta.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--teal-soft)', color: 'var(--teal-ink)' }}>
                          {tools.length} tools
                        </span>
                        {allOn && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: 'var(--font-mono, monospace)', background: '#dcfce7', color: '#166534' }}>
                            ✓ Enabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{meta.description}</p>
                      <p className="text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-4)' }}>by {meta.owner}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(prefix)}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}
                      >
                        {isExpanded ? 'Hide tools' : 'View tools'}
                      </button>
                      <button
                        onClick={() => toggleServer(prefix)}
                        className="text-xs px-4 py-1.5 rounded-full font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: allOn ? 'var(--ink-3)' : 'var(--teal)' }}
                      >
                        {allOn ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-5 py-3 space-y-2" style={{ borderColor: 'var(--border-2)', background: 'var(--teal-softer)' }}>
                      {tools.map((t) => (
                        <div key={t.toolId} className="flex items-start gap-3">
                          <code
                            className="text-[11px] px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                            style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--surface)', border: '1px solid var(--teal-soft)', color: 'var(--teal-ink)' }}
                          >
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

        {/* Future: Add external MCP */}
        <div className="mt-8 rounded-xl border-2 border-dashed px-6 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--ink-3)' }}>Add External MCP Server</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-4)' }}>
            Connect any HTTP MCP server — tools will be discovered automatically.
          </p>
          <button
            className="mt-4 text-xs px-4 py-2 rounded-full font-medium border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-3)', background: 'var(--bg)' }}
            onClick={() => toast('External MCP support coming in v2', false)}
          >
            + Add MCP Server
          </button>
        </div>
      </div>
    </div>
  )
}
