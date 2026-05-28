import { streamText } from 'ai'
import { sql } from '@/lib/db'
import { resolveModel, isOpenWebUI } from '@/lib/provider'
import { compileSystemPrompt } from '@/lib/compile'
import { getToolsForCompany } from '@/tools/index'
import type { Company, Persona, PersonaModule, CompanyTool } from '@/lib/types'

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

  const systemPrompt = compileSystemPrompt(company, activeModules, toolIds)

  // When using Open WebUI: MCPs are registered there, don't double-define tools.
  // When using OpenRouter/Ollama: use our TypeScript tool definitions.
  const tools = isOpenWebUI() ? undefined : getToolsForCompany(toolIds)

  const result = streamText({
    model: resolveModel(),
    system: systemPrompt,
    ...(tools ? { tools, maxSteps: 8 } : {}),
    messages,
  })

  return result.toDataStreamResponse()
}
