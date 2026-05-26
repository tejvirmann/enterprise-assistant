import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

export function resolveModel(): LanguageModel {
  const provider = process.env.PROVIDER ?? 'openrouter'

  if (provider === 'openwebui') {
    // Open WebUI exposes an OpenAI-compatible endpoint at /api
    // No API key needed when WEBUI_AUTH=False
    const baseURL = (process.env.OPENWEBUI_URL ?? 'http://localhost:4000') + '/api'
    const model = process.env.OPENWEBUI_MODEL ?? 'openwebui/current'
    const openwebui = createOpenAI({ baseURL, apiKey: 'no-auth' })
    return openwebui(model)
  }

  if (provider === 'ollama') {
    const baseURL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') + '/v1'
    const model = process.env.OLLAMA_MODEL ?? 'qwen3:8b'
    const ollama = createOpenAI({ baseURL, apiKey: 'ollama' })
    return ollama(model)
  }

  // Default: OpenRouter (OpenAI-compatible)
  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
  })
  return openrouter(process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4-5')
}

export function isOpenWebUI() {
  return (process.env.PROVIDER ?? 'openrouter') === 'openwebui'
}
