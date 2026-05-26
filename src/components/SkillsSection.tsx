import { CollapsibleSection } from './CollapsibleSection'
import type { PersonaModule, CompanyTool } from '@/lib/types'

interface Props {
  modules: PersonaModule[]
  tools: CompanyTool[]
}

export function SkillsSection({ modules, tools }: Props) {
  const activeModules = modules.filter((m) => m.enabled)
  const activeTools = tools.filter((t) => t.enabled)

  return (
    <CollapsibleSection
      title="Skills & Tools"
      badge={activeModules.length + activeTools.length}
    >
      <div className="space-y-4">
        {activeModules.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-2">
              Context modules
            </p>
            <div className="space-y-1">
              {activeModules.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0"
                >
                  <div>
                    <span className="text-sm text-gray-200">{m.name}</span>
                    {m.description && (
                      <p className="text-xs text-gray-600 mt-0.5">{m.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-xs font-mono text-gray-700 capitalize">{m.type}</span>
                    {m.tokens && (
                      <span className="text-xs font-mono text-gray-700">~{m.tokens}t</span>
                    )}
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTools.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-2">
              MCP tools
            </p>
            <div className="space-y-1">
              {activeTools.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0"
                >
                  <span className="text-sm font-mono text-gray-300">{t.tool_id}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
