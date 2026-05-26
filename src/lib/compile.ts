import type { Company, PersonaModule } from './types'

// Mirrors generate.py + _push_to_openwebui() from lattice-poc.
// Assembles the system prompt from:
//   1. Company base context (always-on, like context.md)
//   2. Active persona module content (skills + blueprints)
//   3. Session header listing what's loaded
export function compileSystemPrompt(
  company: Company,
  modules: PersonaModule[],
  toolIds: string[],
): string {
  const activeModules = modules.filter((m) => m.enabled && m.content)

  const header = buildHeader(company, activeModules, toolIds)
  const body = activeModules.map((m) => m.content!.trim()).join('\n\n---\n\n')

  const parts = [header]
  if (company.base_context) parts.push(company.base_context.trim())
  if (body) parts.push(body)

  return parts.join('\n\n---\n\n')
}

function buildHeader(
  company: Company,
  modules: PersonaModule[],
  toolIds: string[],
): string {
  const lines: string[] = [
    `# ${company.name} Agent`,
    '',
    '## Context Loaded',
  ]

  const byType: Record<string, PersonaModule[]> = {}
  for (const m of modules) {
    ;(byType[m.type] ??= []).push(m)
  }

  for (const [type, mods] of Object.entries(byType)) {
    lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s`)
    for (const m of mods) {
      const tok = m.tokens ? `  (~${m.tokens} tokens)` : ''
      lines.push(`- **${m.name}**${tok}`)
    }
  }

  if (toolIds.length > 0) {
    lines.push('', '## MCP Tools Available')
    for (const id of toolIds) {
      lines.push(`- **${id}**`)
    }
  }

  return lines.join('\n')
}
