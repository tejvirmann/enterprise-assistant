import { CollapsibleSection } from './CollapsibleSection'

// v1: read-only — shows what data systems are available.
// v2: drag-and-drop file upload + "generate context from data" button.

const DEMO_SOURCES = [
  { name: 'LIMS', description: 'Compounds · Samples · Assay results · Instruments', count: '24 samples, 192 results' },
  { name: 'QMS', description: 'Batches · Deviations · CAPAs · Specifications · Audits', count: '20 batches, 8 deviations' },
  { name: 'Rosetta', description: 'Term mappings · Unit conversions · Compound aliases', count: '22 mappings' },
]

export function DataSection() {
  return (
    <CollapsibleSection title="Data" badge={DEMO_SOURCES.length}>
      <div className="space-y-2">
        {DEMO_SOURCES.map((src) => (
          <div
            key={src.name}
            className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0"
          >
            <div>
              <span className="text-sm font-medium text-gray-200">{src.name}</span>
              <p className="text-xs text-gray-600 mt-0.5">{src.description}</p>
            </div>
            <span className="text-xs font-mono text-gray-700 ml-4 flex-shrink-0">{src.count}</span>
          </div>
        ))}
        <p className="text-xs text-gray-700 pt-1">
          File upload + "generate context from data" available in v2.
        </p>
      </div>
    </CollapsibleSection>
  )
}
