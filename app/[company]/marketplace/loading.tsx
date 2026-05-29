export default function MarketplaceLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse" style={{ background: 'var(--bg)' }}>
      <div className="px-8 py-5 border-b bg-white" style={{ borderColor: 'var(--border)' }}>
        <div className="h-6 w-32 rounded-lg mb-2" style={{ background: '#e2e8f0' }} />
        <div className="h-4 w-56 rounded mb-4" style={{ background: '#f1f5f9' }} />
        <div className="h-9 rounded-xl" style={{ background: '#f1f5f9' }} />
      </div>
      <div className="px-8 py-6 space-y-3 max-w-4xl">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 rounded-xl border bg-white" style={{ borderColor: 'var(--border)' }} />
        ))}
      </div>
    </div>
  )
}
