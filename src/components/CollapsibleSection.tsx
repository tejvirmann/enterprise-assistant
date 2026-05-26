'use client'

import { useState } from 'react'

interface Props {
  title: string
  badge?: string | number
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ title, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-medium tracking-widest uppercase text-gray-400">
            {open ? '▼' : '▶'}
          </span>
          <span className="text-sm font-medium text-gray-200">{title}</span>
          {badge !== undefined && (
            <span className="text-xs bg-gray-700 text-gray-400 rounded px-1.5 py-0.5 font-mono">
              {badge}
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 bg-gray-950 border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  )
}
