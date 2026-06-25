import { streamText, jsonSchema, type Tool } from 'ai'
import { sql } from '@/lib/db'
import { resolveModel, isOpenWebUI } from '@/lib/provider'
import { compileSystemPrompt } from '@/lib/compile'
import { getEffectiveModules, getEffectiveTools, getEffectiveMcpServers } from '@/lib/presets'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getToolsForCompany } from '@/tools/index'
import type { Company, Persona, McpServerTool } from '@/lib/types'

export async function POST(req: Request) {
  const { messages, companySlug, activeToolIds: clientToolIds, activeModuleIds: clientModuleIds } = await req.json()

  if (!companySlug) {
    return new Response('companySlug required', { status: 400 })
  }

  // Load company → persona → modules → tools
  const companies = await sql`SELECT * FROM companies WHERE id = ${companySlug}`
  if (!companies.length) {
    return new Response('Company not found', { status: 404 })
  }
  const company = companies[0] as Company

  const clientIp = getClientIp(req)
  const rl = await checkRateLimit(companySlug, clientIp, company.rate_limit_per_minute, company.rate_limit_per_visitor_per_minute)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: rl.scope === 'company' ? 'This deployment has hit its message limit. Try again shortly.' : 'You\'re sending messages too quickly. Try again shortly.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec ?? 60) } }
    )
  }

  const personaId = company.default_persona_id
  if (!personaId) {
    return new Response('No default persona configured', { status: 500 })
  }

  const personas = await sql`SELECT * FROM personas WHERE id = ${personaId}`
  const persona = personas[0] as Persona

  const allModules = await getEffectiveModules(companySlug, personaId)
  const allCompanyTools = await getEffectiveTools(companySlug)

  // Use client overrides if provided, otherwise fall back to DB defaults
  const activeModules = Array.isArray(clientModuleIds)
    ? allModules.filter((m) => clientModuleIds.includes(m.id))
    : allModules.filter((m) => m.enabled)

  const toolIds: string[] = Array.isArray(clientToolIds)
    ? clientToolIds.filter((id: string) => allCompanyTools.some((t) => t.tool_id === id))
    : allCompanyTools.filter((t) => t.enabled).map((t) => t.tool_id)

  const mcpServers = (await getEffectiveMcpServers(companySlug)).filter((s) => s.enabled)

  const systemPrompt = compileSystemPrompt(company, activeModules, toolIds)

  // When using Open WebUI: MCPs are registered there, don't double-define tools.
  // When using OpenRouter/Ollama: use our TypeScript tool definitions.
  const builtinTools = isOpenWebUI() ? {} : getToolsForCompany(toolIds)

  // Build dynamic proxy tools for each enabled MCP server
  const mcpTools: Record<string, Tool> = {}
  for (const server of mcpServers) {
    const serverTools = (server.tools ?? []) as McpServerTool[]
    for (const tool of serverTools) {
      const toolKey = `mcp_${server.id}_${tool.name.replace(/[^a-zA-Z0-9_]/g, '_')}`
      mcpTools[toolKey] = {
        description: `[${server.name}] ${tool.description}`,
        parameters: jsonSchema(
          (tool.inputSchema && typeof tool.inputSchema === 'object' && (tool.inputSchema as Record<string, unknown>).type)
            ? tool.inputSchema as Parameters<typeof jsonSchema>[0]
            : { type: 'object' as const, properties: {} }
        ),
        execute: async (args: Record<string, unknown>) => {
          try {
            const res = await fetch(server.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool.name, arguments: args } }),
              signal: AbortSignal.timeout(30_000),
            })
            const data = await res.json() as { result?: { content?: Array<{ type: string; text?: string }> }; error?: { message: string } }
            if (data.error) return `Error: ${data.error.message}`
            return data.result?.content?.map((c) => c.text ?? '').join('\n') ?? JSON.stringify(data.result)
          } catch (e) {
            return `MCP call failed: ${e instanceof Error ? e.message : 'unknown error'}`
          }
        },
      }
    }
  }

  const tools = Object.keys(builtinTools).length || Object.keys(mcpTools).length
    ? { ...builtinTools, ...mcpTools }
    : undefined

  const result = streamText({
    model: resolveModel(),
    system: systemPrompt,
    ...(tools ? { tools, maxSteps: 8 } : {}),
    messages,
  })

  return result.toDataStreamResponse()
}
