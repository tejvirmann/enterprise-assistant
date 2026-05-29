'use client'

import { useChat } from 'ai/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  companySlug: string
  brandColor: string
  activeToolIds: string[]
  activeModuleIds: number[]
  suggestions?: string[]
  welcomeMessage?: string
}

const DEFAULT_SUGGESTIONS = [
  'What tools and context do I have loaded?',
  'Show me all open critical deviations and CAPAs.',
  'Is the most recent batch ready for release?',
  'Compare HPLC Purity results for XB-441 across all batches.',
]

function parseThinking(content: string): { thinking: string | null; response: string } {
  const closeIdx = content.indexOf('</think>')
  if (content.startsWith('<think>') && closeIdx !== -1) {
    return { thinking: content.slice(7, closeIdx).trim(), response: content.slice(closeIdx + 8).trim() }
  }
  if (content.startsWith('<think>')) return { thinking: content.slice(7), response: '' }
  return { thinking: null, response: content }
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors"
        style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--teal-softer)', color: 'var(--teal-ink)' }}
      >
        <span style={{ color: 'var(--teal)', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        Thinking…
        <span className="ml-auto" style={{ color: 'var(--ink-4)' }}>{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div
          className="px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
          style={{ background: 'var(--surface)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono, monospace)' }}
        >
          {text}
        </div>
      )}
    </div>
  )
}

const mdComponents = {
  // pre wraps ALL block code — set container styles here
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg text-xs leading-relaxed"
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        background: 'var(--surface-2)',
        color: 'var(--ink-2)',
        border: '1px solid var(--border)',
        padding: '0.75rem',
        whiteSpace: 'pre',
      }}
      {...props}
    >
      {children}
    </pre>
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse" style={{ borderColor: 'var(--border)' }} {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead style={{ background: 'var(--teal-softer)' }} {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold border"
      style={{ color: 'var(--ink-2)', borderColor: 'var(--border)', letterSpacing: '.04em' }}
      {...props}
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableDataCellElement>) => (
    <td
      className="px-3 py-2 text-sm border"
      style={{ color: 'var(--ink)', borderColor: 'var(--border)' }}
      {...props}
    />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr
      className="transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--teal-softer)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
      {...props}
    />
  ),
  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
    // Block code (inside <pre>): pass through without extra styling — pre handles it.
    // Inline code: no newlines, no language class.
    const isBlock = !!className || String(children ?? '').includes('\n')
    if (isBlock) {
      return <code className={className ?? ''} {...props}>{children}</code>
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded text-xs"
        style={{
          fontFamily: 'var(--font-mono, monospace)',
          background: 'var(--teal-softer)',
          color: 'var(--teal-ink)',
          border: '1px solid var(--teal-soft)',
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-base font-semibold mt-4 mb-2" style={{ color: 'var(--indigo)' }} {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--indigo)' }} {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-medium mt-3 mb-1.5" style={{ color: 'var(--ink-2)' }} {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-2 leading-relaxed" style={{ color: 'var(--ink)' }} {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5" style={{ color: 'var(--ink)' }} {...props} />
  ),
  ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5" style={{ color: 'var(--ink)' }} {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="pl-3 py-0.5 my-2 italic"
      style={{ borderLeft: '3px solid var(--teal)', color: 'var(--ink-3)' }}
      {...props}
    />
  ),
  hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
}

export function Chat({ companySlug, brandColor, activeToolIds, activeModuleIds, suggestions, welcomeMessage }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  // Stores a steered message to send after current generation stops
  const pendingSteerRef = useRef<string | null>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: { companySlug, activeToolIds, activeModuleIds },
    maxSteps: 8,
  })

  // ESC stops generation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLoading, stop])

  // When generation stops, fire any queued steer message
  useEffect(() => {
    if (!isLoading && pendingSteerRef.current) {
      const text = pendingSteerRef.current
      pendingSteerRef.current = null
      setAtBottom(true)
      append({ role: 'user', content: text })
    }
  }, [isLoading, append])

  // Track whether the user is near the bottom of the scroll container
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setAtBottom(dist < 100)
  }, [])

  // Instant scroll to bottom during streaming (smooth causes animation pile-up jank)
  useEffect(() => {
    if (!atBottom) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, atBottom])

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    if (isLoading) {
      // Steer: stop current run, queue message to send once stopped
      pendingSteerRef.current = input
      setInput('')
      stop()
      return
    }
    setAtBottom(true)
    handleSubmit(e)
  }, [input, isLoading, stop, handleSubmit, setInput])

  const activeSuggestions = suggestions ?? DEFAULT_SUGGESTIONS

  return (
    <div className="flex flex-col h-full min-h-0 relative" style={{ background: 'var(--bg)' }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-4xl mx-auto w-full"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 pb-12">
            <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
              {welcomeMessage ?? 'Agent is ready. Try a prompt or type your own.'}
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {activeSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs rounded-lg px-3.5 py-2.5 border transition-all"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal-ink)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-3)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div
                  className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm font-medium"
                  style={{ background: brandColor, color: '#fff' }}
                >
                  {m.content}
                </div>
              </div>
            )
          }

          const toolParts = m.parts?.filter((p) => p.type === 'tool-invocation') ?? []
          const textContent = m.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => (p.type === 'text' ? p.text : ''))
            .join('') ?? m.content

          const { thinking, response } = parseThinking(textContent)

          return (
            <div key={m.id} className="space-y-1 pl-6">
              {toolParts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {toolParts.map((part, i) => {
                    if (part.type !== 'tool-invocation') return null
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          background: part.toolInvocation.state === 'result' ? 'var(--teal-softer)' : 'var(--surface-2)',
                          borderColor: part.toolInvocation.state === 'result' ? 'var(--teal-soft)' : 'var(--border)',
                          color: part.toolInvocation.state === 'result' ? 'var(--teal-ink)' : 'var(--ink-4)',
                        }}
                      >
                        {part.toolInvocation.state === 'result' ? '✓' : '…'} {part.toolInvocation.toolName}
                      </span>
                    )
                  })}
                </div>
              )}

              {thinking && <ThinkingBlock text={thinking} />}

              {response && (
                <div className="prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as never}>
                    {response}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="pl-6 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: 'var(--ink-4)' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: 'var(--ink-4)' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: 'var(--ink-4)' }} />
            </div>
          </div>
        )}
        <div className="h-2" />
      </div>

      {/* Jump-to-latest button — appears when user has scrolled up */}
      {!atBottom && (
        <button
          onClick={() => {
            setAtBottom(true)
            const el = scrollRef.current
            if (el) el.scrollTop = el.scrollHeight
          }}
          className="absolute bottom-[72px] right-8 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border shadow-md transition-all z-10"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-3)' }}
        >
          ↓ Latest
        </button>
      )}

      {/* Input bar */}
      <div
        className="flex-shrink-0 border-t px-8 py-4 max-w-4xl mx-auto w-full"
        style={{ borderColor: 'var(--border)' }}
      >
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          <span
            className="text-sm font-semibold flex-shrink-0 select-none"
            style={{ color: brandColor, fontFamily: 'var(--font-mono, monospace)' }}
          >
            &gt;
          </span>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={isLoading ? 'Type to steer, or ESC to stop…' : 'Ask anything…'}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--ink)', caretColor: brandColor }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(220,38,38,.08)',
                color: '#dc2626',
                border: '1px solid rgba(220,38,38,.25)',
              }}
            >
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#dc2626' }} />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: brandColor }}
            >
              Send
            </button>
          )}
        </form>
        {isLoading && input.trim() && (
          <p className="mt-1 text-[10px]" style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono, monospace)' }}>
            ↵ send to stop & steer
          </p>
        )}
        <div className="mt-1.5 h-px" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}
