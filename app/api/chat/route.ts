import { streamText, jsonSchema, type Tool } from 'ai'
import { sql } from '@/lib/db'
import { resolveModel, isOpenWebUI } from '@/lib/provider'
import { compileSystemPrompt } from '@/lib/compile'
import { getToolsForCompany } from '@/tools/index'
import type { Company, Persona, PersonaModule, CompanyTool, McpServer, McpServerTool } from '@/lib/types'

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

  const personaId = company.default_persona_id
  if (!personaId) {
    return new Response('No default persona configured', { status: 500 })
  }

  const personas = await sql`SELECT * FROM personas WHERE id = ${personaId}`
  const persona = personas[0] as Persona

  const allModules = await sql`
    SELECT * FROM persona_modules
    WHERE persona_id = ${personaId}
    ORDER BY type, name
  ` as PersonaModule[]

  const allCompanyTools = await sql`
    SELECT * FROM company_tools
    WHERE company_id = ${companySlug}
  ` as CompanyTool[]

  // Use client overrides if provided, otherwise fall back to DB defaults
  const activeModules = Array.isArray(clientModuleIds)
    ? allModules.filter((m) => clientModuleIds.includes(m.id))
    : allModules.filter((m) => m.enabled)

  const toolIds: string[] = Array.isArray(clientToolIds)
    ? clientToolIds.filter((id: string) => allCompanyTools.some((t) => t.tool_id === id))
    : allCompanyTools.filter((t) => t.enabled).map((t) => t.tool_id)

  const mcpServers = await sql`
    SELECT * FROM company_mcp_servers
    WHERE company_id = ${companySlug} AND enabled = true
  ` as McpServer[]

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
