export interface Company {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  color: string
  base_context: string | null
  default_persona_id: string | null
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

export interface CompanyTool {
  id: number
  company_id: string
  tool_id: string
  enabled: boolean
}

export interface CompanyData {
  company: Company
  persona: Persona
  modules: PersonaModule[]
  tools: CompanyTool[]
}
