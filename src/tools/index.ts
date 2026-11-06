import type { ToolSet } from 'ai'
import { limsTools } from './lims'
import { qmsTools } from './qms'
import { rosettaTools } from './rosetta'
import { projectTools } from './projects'
import { portfolioTools } from './portfolio'
import { demoTools } from './demos'

export const ALL_TOOLS = {
  ...limsTools,
  ...qmsTools,
  ...rosettaTools,
  ...projectTools,
  ...portfolioTools,
  ...demoTools,
}

export type ToolId = keyof typeof ALL_TOOLS

// Returns only the tools a company has enabled
export function getToolsForCompany(toolIds: string[]): ToolSet {
  return Object.fromEntries(
    toolIds
      .filter((id) => id in ALL_TOOLS)
      .map((id) => [id, ALL_TOOLS[id as ToolId]])
  ) as ToolSet
}
