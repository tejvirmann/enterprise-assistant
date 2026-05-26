interface Props {
  name: string
  description?: string | null
  color: string
}

export function CompanyHeader({ name, description, color }: Props) {
  return (
    <div
      className="px-6 py-4 border-b border-gray-800 flex items-center gap-3"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div>
        <h1 className="text-lg font-semibold text-white">{name}</h1>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-mono text-gray-600">agent.madstack.net</span>
        <div className="w-2 h-2 rounded-full bg-green-500" title="Agent active" />
      </div>
    </div>
  )
}
