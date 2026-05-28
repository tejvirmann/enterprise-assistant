'use client'

import { useState, useCallback } from 'react'
import { ConfigPanel } from './ConfigPanel'
import { Chat } from './Chat'
import type { CompanyData } from '@/lib/types'

interface Props {
  data: CompanyData
}

export function CompanyStudio({ data }: Props) {
  const { company, persona, modules, tools } = data

  const [activeModuleIds, setActiveModuleIds] = useState<number[]>(
    modules.filter((m) => m.enabled).map((m) => m.id)
  )
  const [activeToolIds, setActiveToolIds] = useState<string[]>(
    tools.filter((t) => t.enabled).map((t) => t.tool_id)
  )
  const [chatKey, setChatKey] = useState(0)

  const toggleModule = useCallback((id: number) => {
    setActiveModuleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }, [])

  const toggleServer = useCallback((prefix: string) => {
    const serverIds = tools
      .filter((t) => t.tool_id.startsWith(prefix + '_'))
      .map((t) => t.tool_id)
    setActiveToolIds((prev) => {
      const allActive = serverIds.every((id) => prev.includes(id))
      if (allActive) return prev.filter((id) => !serverIds.includes(id))
      return [...new Set([...prev, ...serverIds])]
    })
  }, [tools])

  const relaunch = useCallback(() => setChatKey((k) => k + 1), [])

  return (
    <div
      className="flex flex-col h-screen"
      style={{ '--brand': company.color } as React.CSSProperties}
    >
      {/* Nav bar */}
      <header
        className="flex items-center gap-6 px-7 flex-shrink-0 border-b border-white/5"
        style={{ background: 'var(--indigo)', height: 54 }}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-white font-bold text-[15px] tracking-tight">{company.name} Demo</span>
          <span
            className="text-[10px] font-medium tracking-[.08em] opacity-60"
            style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--teal)' }}
          >
            by MadStack
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="text-[10px] font-medium tracking-[.08em] uppercase px-2.5 py-1 rounded-full border"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              background: 'rgba(54,153,150,.18)',
              color: 'var(--teal)',
              borderColor: 'rgba(54,153,150,.35)',
            }}
          >
            Active
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <ConfigPanel
          company={company}
          persona={persona}
          modules={modules}
          tools={tools}
          activeModuleIds={activeModuleIds}
          activeToolIds={activeToolIds}
          onToggleModule={toggleModule}
          onToggleServer={toggleServer}
          onRelaunch={relaunch}
        />
        <div className="flex-1 min-w-0" style={{ background: 'var(--bg)' }}>
          <Chat
            key={chatKey}
            companySlug={company.id}
            brandColor={company.color}
            activeToolIds={activeToolIds}
            activeModuleIds={activeModuleIds}
          />
        </div>
      </div>
    </div>
  )
}
