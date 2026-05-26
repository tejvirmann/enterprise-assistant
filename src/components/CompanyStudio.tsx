'use client'

import { CompanyHeader } from './CompanyHeader'
import { DataSection } from './DataSection'
import { SkillsSection } from './SkillsSection'
import { ConfigSection } from './ConfigSection'
import { Chat } from './Chat'
import type { CompanyData } from '@/lib/types'

interface Props {
  data: CompanyData
}

export function CompanyStudio({ data }: Props) {
  const { company, persona, modules, tools } = data

  return (
    <div className="flex flex-col h-screen bg-gray-950" style={{ '--brand': company.color } as React.CSSProperties}>
      <CompanyHeader
        name={company.name}
        description={company.description}
        color={company.color}
      />

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — config panels */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto p-3 space-y-2">
          <DataSection />
          <SkillsSection modules={modules} tools={tools} />
          <ConfigSection persona={persona} modules={modules} />
        </div>

        {/* Right — chat, full height */}
        <div className="flex-1 min-w-0">
          <Chat
            companySlug={company.id}
            brandColor={company.color}
          />
        </div>
      </div>
    </div>
  )
}
