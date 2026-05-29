export default function SessionLoading() {
  return (
    <div className="flex h-full animate-pulse" style={{ background: 'var(--bg)' }}>
      <div className="w-80 border-r flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
      <div className="flex-1" />
    </div>
  )
}
