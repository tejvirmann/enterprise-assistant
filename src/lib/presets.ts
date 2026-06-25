import { sql } from './db'
import type { PersonaModule, McpServer, McpServerTool } from './types'

export interface Preset {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface EffectiveTool {
  tool_id: string
  enabled: boolean
  source: 'preset' | 'company'
}

export type EffectiveMcpServer = McpServer & { source: 'preset' | 'company' }
export type EffectiveModule = PersonaModule & { source: 'preset' | 'company' }

async function getCompanyPresetId(companyId: string): Promise<string | null> {
  const rows = await sql`SELECT preset_id FROM companies WHERE id = ${companyId}`
  return (rows[0]?.preset_id as string | null) ?? null
}

async function getExclusions(companyId: string, kind: 'tool' | 'mcp_server' | 'module'): Promise<Set<string>> {
  const rows = await sql`
    SELECT ref_id FROM company_preset_exclusions WHERE company_id = ${companyId} AND kind = ${kind}
  ` as { ref_id: string }[]
  return new Set(rows.map((r) => r.ref_id))
}

// All tool ids the company has access to (preset defaults minus exclusions, plus its own rows),
// each tagged with where it came from and whether it's currently enabled.
export async function getEffectiveTools(companyId: string): Promise<EffectiveTool[]> {
  const companyTools = await sql`
    SELECT tool_id, enabled FROM company_tools WHERE company_id = ${companyId}
  ` as { tool_id: string; enabled: boolean }[]

  const presetId = await getCompanyPresetId(companyId)
  if (!presetId) {
    return companyTools.map((t) => ({ tool_id: t.tool_id, enabled: t.enabled, source: 'company' as const }))
  }

  const excluded = await getExclusions(companyId, 'tool')
  const presetTools = await sql`
    SELECT tool_id FROM preset_tools WHERE preset_id = ${presetId}
  ` as { tool_id: string }[]

  const companyToolIds = new Set(companyTools.map((t) => t.tool_id))
  const result: EffectiveTool[] = companyTools.map((t) => ({ tool_id: t.tool_id, enabled: t.enabled, source: 'company' as const }))
  for (const t of presetTools) {
    if (!excluded.has(t.tool_id) && !companyToolIds.has(t.tool_id)) {
      result.push({ tool_id: t.tool_id, enabled: true, source: 'preset' })
    }
  }
  return result
}

export async function getEffectiveToolIds(companyId: string): Promise<string[]> {
  const tools = await getEffectiveTools(companyId)
  return tools.filter((t) => t.enabled).map((t) => t.tool_id)
}

export async function getEffectiveMcpServers(companyId: string): Promise<EffectiveMcpServer[]> {
  const companyServers = await sql`
    SELECT * FROM company_mcp_servers WHERE company_id = ${companyId}
  ` as McpServer[]

  const presetId = await getCompanyPresetId(companyId)
  const result: EffectiveMcpServer[] = companyServers.map((s) => ({ ...s, source: 'company' as const }))
  if (!presetId) return result

  const excluded = await getExclusions(companyId, 'mcp_server')
  const presetServers = await sql`
    SELECT * FROM preset_mcp_servers WHERE preset_id = ${presetId}
  ` as { id: number; preset_id: string; name: string; url: string; transport: string; tools: McpServerTool[]; last_scanned: string | null; created_at: string }[]

  for (const s of presetServers) {
    if (excluded.has(String(s.id))) continue
    result.push({
      id: s.id,
      company_id: companyId,
      name: s.name,
      url: s.url,
      transport: s.transport,
      enabled: true,
      tools: s.tools ?? [],
      last_scanned: s.last_scanned,
      created_at: s.created_at,
      source: 'preset',
    })
  }
  return result
}

// Preset modules attach only to a company's default persona — they represent
// the deployment's default loadout, not every persona created under it.
export async function getEffectiveModules(companyId: string, personaId: string): Promise<EffectiveModule[]> {
  const personaModules = await sql`
    SELECT * FROM persona_modules WHERE persona_id = ${personaId} ORDER BY type, name
  ` as PersonaModule[]
  const result: EffectiveModule[] = personaModules.map((m) => ({ ...m, source: 'company' as const }))

  const companies = await sql`SELECT preset_id, default_persona_id FROM companies WHERE id = ${companyId}`
  const presetId = companies[0]?.preset_id as string | null
  const defaultPersonaId = companies[0]?.default_persona_id as string | null
  if (!presetId || personaId !== defaultPersonaId) return result

  const excluded = await getExclusions(companyId, 'module')
  const presetModules = await sql`
    SELECT * FROM preset_modules WHERE preset_id = ${presetId} ORDER BY type, name
  ` as { id: number; preset_id: string; type: string; name: string; description: string | null; tokens: number | null; content: string | null; example_prompts: string[] | null }[]

  for (const m of presetModules) {
    if (excluded.has(String(m.id))) continue
    result.push({
      id: m.id,
      persona_id: personaId,
      repo_id: null,
      path: null,
      type: m.type,
      name: m.name,
      description: m.description,
      tokens: m.tokens,
      enabled: true,
      content: m.content,
      example_prompts: m.example_prompts ?? [],
      source: 'preset',
    })
  }
  return result
}
