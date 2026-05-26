'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef } from 'react'

interface Props {
  companySlug: string
  brandColor: string
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  'What MCP tools and context do I have?',
  'Show me all open critical deviations and their CAPAs.',
  'Is the most recent batch ready for release?',
  'Compare HPLC Purity results for XB-441 across all batches.',
]

export function Chat({ companySlug, brandColor, suggestions }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: '/api/chat',
    body: { companySlug },
    maxSteps: 8,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeSuggestions = suggestions ?? DEFAULT_SUGGESTIONS

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center pb-8">
            <p className="text-gray-600 text-sm">Agent is ready. Try a prompt below or type your own.</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
              {activeSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs text-gray-400 border border-gray-800 rounded-lg px-3 py-2 hover:border-gray-600 hover:text-gray-200 transition-colors bg-gray-900"
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
              <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0 mr-2 mt-1 flex items-center justify-center">
                <span className="text-xs text-gray-400">A</span>
              </div>
            )}
            <div
              className={`rounded-lg px-4 py-2.5 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'text-white'
                  : 'bg-gray-900 text-gray-100 border border-gray-800'
              }`}
              style={m.role === 'user' ? { backgroundColor: brandColor } : {}}
            >
              {m.parts?.map((part, i) => {
                if (part.type === 'text') return <span key={i}>{part.text}</span>
                if (part.type === 'tool-invocation') {
                  return (
                    <div key={i} className="text-xs font-mono text-gray-500 border border-gray-800 rounded px-2 py-1 my-1 bg-gray-950">
                      <span className="text-gray-600">tool:</span> {part.toolInvocation.toolName}
                      {part.toolInvocation.state === 'result' && (
                        <span className="text-green-700 ml-1">✓</span>
                      )}
                    </div>
                  )
                }
                return null
              }) ?? m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0 mr-2 mt-1" />
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-800 bg-gray-950"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything..."
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: brandColor }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
