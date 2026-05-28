'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef } from 'react'

interface Props {
  companySlug: string
  brandColor: string
  activeToolIds: string[]
  activeModuleIds: number[]
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  'What tools and context do I have loaded?',
  'Show me all open critical deviations and CAPAs.',
  'Is the most recent batch ready for release?',
  'Compare HPLC Purity results for XB-441 across all batches.',
]

export function Chat({ companySlug, brandColor, activeToolIds, activeModuleIds, suggestions }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
    body: { companySlug, activeToolIds, activeModuleIds },
    maxSteps: 8,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeSuggestions = suggestions ?? DEFAULT_SUGGESTIONS

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center pb-8">
            <p className="text-sm" style={{ color: 'var(--ink-4)' }}>
              Agent is ready. Try a prompt below or type your own.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
              {activeSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs rounded-lg px-3.5 py-2.5 border transition-all hover:shadow-sm"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--ink-3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--teal)'
                    e.currentTarget.style.color = 'var(--teal-ink)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--ink-3)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center text-[10px] font-medium text-white"
                style={{ background: 'var(--indigo)', fontFamily: 'var(--font-mono, monospace)' }}
              >
                A
              </div>
            )}
            <div
              className="rounded-xl px-4 py-2.5 max-w-2xl text-sm leading-relaxed"
              style={
                m.role === 'user'
                  ? { background: brandColor, color: '#fff' }
                  : {
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--sh)',
                    }
              }
            >
              {m.parts?.map((part, i) => {
                if (part.type === 'text') {
                  return <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                }
                if (part.type === 'tool-invocation') {
                  return (
                    <div
                      key={i}
                      className="text-[11px] rounded px-2 py-1 my-1.5 flex items-center gap-1.5"
                      style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        background: 'var(--teal-softer)',
                        border: '1px solid var(--teal-soft)',
                        color: 'var(--ink-3)',
                      }}
                    >
                      <span style={{ color: 'var(--ink-4)' }}>tool:</span>
                      <span style={{ color: 'var(--teal-ink)' }}>{part.toolInvocation.toolName}</span>
                      {part.toolInvocation.state === 'result' && (
                        <span style={{ color: 'var(--success)' }} className="ml-auto">✓</span>
                      )}
                    </div>
                  )
                }
                return null
              }) ?? <span className="whitespace-pre-wrap">{m.content}</span>}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-0.5"
              style={{ background: 'var(--indigo)' }}
            />
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" style={{ background: 'var(--ink-4)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: 'var(--ink-4)' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: 'var(--ink-4)' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything…"
            className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--teal)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(54,153,150,.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: brandColor }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
