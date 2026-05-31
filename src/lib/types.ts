export type { BrandConfig } from './theme'

export interface Company {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  color: string
  base_context: string | null
  default_persona_id: string | null
  admin_key: string | null
}

export interface Persona {
  id: string
  company_id: string
  name: string
  description: string | null
  created_at: string
}

export interface PersonaModule {
  id: number
  persona_id: string
  repo_id: string | null
  path: string | null
  type: string
  name: string
  description: string | null
  tokens: number | null
  enabled: boolean
  content: string | null
}

export interface Repo {
  id: string
  name: string
  description: string | null
  repo_url: string | null
  owner: string | null
  scope: string
  verified: boolean
  module_count: number
}

export interface RepoModule {
  id: number
  repo_id: string
  path: string
  type: string
  name: string
  description: string | null
  tokens: number | null
  content: string | null
}

export interface CompanyTool {
  id: number
  company_id: string
  tool_id: string
  enabled: boolean
}

export interface McpServerTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServer {
  id: number
  company_id: string
  name: string
  url: string
  transport: string
  enabled: boolean
  tools: McpServerTool[]
  last_scanned: string | null
  created_at: string
}

export interface CompanyData {
  company: Company
  persona: Persona
  modules: PersonaModule[]
  tools: CompanyTool[]
}
