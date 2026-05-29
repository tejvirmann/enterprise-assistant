export default function PersonasLoading() {
  return (
    <div className="flex h-full animate-pulse">
      <aside className="border-r flex-shrink-0 p-4 space-y-2" style={{ width: 240, background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="h-8 rounded mb-3" style={{ background: '#e2e8f0' }} />
        {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg" style={{ background: '#f1f5f9' }} />)}
      </aside>
      <div className="flex-1 px-8 py-6 space-y-4">
        <div className="h-7 w-40 rounded-lg" style={{ background: '#e2e8f0' }} />
        <div className="h-4 w-64 rounded" style={{ background: '#f1f5f9' }} />
        {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl border bg-white" style={{ borderColor: 'var(--border)' }} />)}
      </div>
    </div>
  )
}
