'use client'

import { useState } from 'react'

interface Props {
  companyName: string
  data: Record<string, Record<string, Record<string, unknown>[]>>
}

const GROUP_LABELS: Record<string, string> = { lims: 'LIMS', qms: 'QMS', rosetta: 'Rosetta' }

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No rows.</p>
  const columns = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-xs border-collapse">
        <thead style={{ background: 'var(--teal-softer)' }}>
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold border-b" style={{ color: 'var(--ink-2)', borderColor: 'var(--border)', fontFamily: 'var(--font-mono, monospace)' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                  {String(row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SampleDataClient({ companyName, data }: Props) {
  const groupKeys = Object.keys(data)
  const [activeGroup, setActiveGroup] = useState(groupKeys[0] ?? '')
  const tables = activeGroup ? data[activeGroup] : {}
  const tableKeys = Object.keys(tables)
  const [activeTable, setActiveTable] = useState(tableKeys[0] ?? '')

  function selectGroup(g: string) {
    setActiveGroup(g)
    setActiveTable(Object.keys(data[g])[0] ?? '')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="bg-white border-b px-8 py-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--indigo)' }}>Sample Data</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ink-3)' }}>
          The underlying records {companyName}&rsquo;s agent queries when it calls a tool — capped at 50 rows per table.
        </p>
      </div>

      {groupKeys.length === 0 ? (
        <div className="px-8 py-6">
          <p className="text-sm" style={{ color: 'var(--ink-4)' }}>No built-in tool groups are enabled for this company yet — nothing to show.</p>
        </div>
      ) : (
        <div className="px-8 py-6 space-y-4">
          <div className="flex gap-2">
            {groupKeys.map((g) => (
              <button key={g} onClick={() => selectGroup(g)}
                className="text-sm px-4 py-1.5 rounded-full font-medium border transition-colors"
                style={{
                  borderColor: activeGroup === g ? 'var(--teal)' : 'var(--border)',
                  background: activeGroup === g ? 'var(--teal-softer)' : 'var(--surface)',
                  color: activeGroup === g ? 'var(--teal-ink)' : 'var(--ink-3)',
                }}>
                {GROUP_LABELS[g] ?? g}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {tableKeys.map((t) => (
              <button key={t} onClick={() => setActiveTable(t)}
                className="text-xs px-3 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: activeTable === t ? 'var(--teal)' : 'var(--border)',
                  color: activeTable === t ? 'var(--teal-ink)' : 'var(--ink-4)',
                  background: 'var(--surface)',
                }}>
                {t} <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>({tables[t]?.length ?? 0})</span>
              </button>
            ))}
          </div>

          {activeTable && <DataTable rows={tables[activeTable] ?? []} />}
        </div>
      )}
    </div>
  )
}
