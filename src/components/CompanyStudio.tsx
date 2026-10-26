'use client'

import { useState, useCallback, useEffect } from 'react'
import { ConfigPanel } from './ConfigPanel'
import { Chat } from './Chat'
import type { CompanyData } from '@/lib/types'

interface Props {
  data: CompanyData
  chatWelcome?: string
}

export function CompanyStudio({ data, chatWelcome }: Props) {
  const { company, persona, modules, tools } = data

  const [activeModuleIds, setActiveModuleIds] = useState<number[]>(
    modules.filter((m) => m.enabled).map((m) => m.id)
  )
  const [activeToolIds, setActiveToolIds] = useState<string[]>(
    tools.filter((t) => t.enabled).map((t) => t.tool_id)
  )
  const [chatKey, setChatKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // On phones the panel is a full-screen drawer, so start with the chat showing.
  useEffect(() => {
    if (window.matchMedia('(max-width: 800px)').matches) setSidebarOpen(false)
  }, [])

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
    <div className="flex h-full min-h-0">
      {sidebarOpen && (
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
          onCollapse={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 min-w-0 relative" style={{ background: 'transparent' }}>
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-xs px-2.5 py-1.5 transition-colors max-md:text-sm max-md:py-2"
            style={{ border: '1.5px solid var(--ink)', boxShadow: 'var(--sh)', background: 'var(--surface)', color: 'var(--ink-2)' }}
            title="Show panel"
          >
            <span style={{ fontSize: 10 }}>▶</span> Panel
          </button>
        )}
        <Chat
          key={chatKey}
          companySlug={company.id}
          brandColor={company.color}
          activeToolIds={activeToolIds}
          activeModuleIds={activeModuleIds}
          welcomeMessage={chatWelcome}
        />
      </div>
    </div>
  )
}
