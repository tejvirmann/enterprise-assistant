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
      className="flex h-full min-h-0"
      style={{ '--brand': company.color } as React.CSSProperties}
    >
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
  )
}
