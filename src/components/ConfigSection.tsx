import { CollapsibleSection } from './CollapsibleSection'
import type { Persona, PersonaModule } from '@/lib/types'

interface Props {
  persona: Persona
  modules: PersonaModule[]
}

export function ConfigSection({ persona, modules }: Props) {
  const tokenTotal = modules
    .filter((m) => m.enabled && m.tokens)
    .reduce((sum, m) => sum + (m.tokens ?? 0), 0)

  return (
    <CollapsibleSection title="Config">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-600">Persona</span>
          <span className="text-sm text-gray-200">{persona.name}</span>
        </div>
        {persona.description && (
          <p className="text-xs text-gray-500">{persona.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-600">
            Context tokens
          </span>
          <span className="text-xs font-mono text-gray-400">~{tokenTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-600">
            Active modules
          </span>
          <span className="text-xs font-mono text-gray-400">
            {modules.filter((m) => m.enabled).length} / {modules.length}
          </span>
        </div>
      </div>
    </CollapsibleSection>
  )
}
