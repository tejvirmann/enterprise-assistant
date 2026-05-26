import { streamText } from 'ai'
import { sql } from '@/lib/db'
import { resolveModel, isOpenWebUI } from '@/lib/provider'
import { compileSystemPrompt } from '@/lib/compile'
import { getToolsForCompany } from '@/tools/index'
import type { Company, Persona, PersonaModule, CompanyTool } from '@/lib/types'

export async function POST(req: Request) {
  const { messages, companySlug } = await req.json()

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

  const modules = await sql`
    SELECT * FROM persona_modules
    WHERE persona_id = ${personaId}
    ORDER BY type, name
  ` as PersonaModule[]

  const companyTools = await sql`
    SELECT * FROM company_tools
    WHERE company_id = ${companySlug} AND enabled = true
  ` as CompanyTool[]

  const toolIds = companyTools.map((t) => t.tool_id)
  const systemPrompt = compileSystemPrompt(company, modules, toolIds)

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
