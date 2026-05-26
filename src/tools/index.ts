import { limsTools } from './lims'
import { qmsTools } from './qms'
import { rosettaTools } from './rosetta'

export const ALL_TOOLS = {
  ...limsTools,
  ...qmsTools,
  ...rosettaTools,
}

export type ToolId = keyof typeof ALL_TOOLS

// Returns only the tools a company has enabled
export function getToolsForCompany(toolIds: string[]) {
  const result: Partial<typeof ALL_TOOLS> = {}
  for (const id of toolIds) {
    if (id in ALL_TOOLS) {
      result[id as ToolId] = ALL_TOOLS[id as ToolId]
    }
  }
  return result
}
