// The demos MadStack shows people. One list drives the home page, the /demo guide agent, and its tools.
// Name and accent color come from the database; the rest lives here.

export const AGENT_BASE_URL = 'https://agent.madstack.ai'

export interface DemoEntry {
  slug: string
  industry: string
  blurb: string
  tryAsking: string
}

export const DEMO_DIRECTORY: DemoEntry[] = [
  {
    slug: 'lattice',
    industry: 'Biologics manufacturing',
    blurb: 'Biologics manufacturing. Ask questions across lab (LIMS), quality (QMS) and term-normalization (Rosetta) systems, with tech-transfer and batch-release blueprints.',
    tryAsking: 'Compare HPLC purity for XB-441 across batches',
  },
  {
    slug: 'findorff',
    industry: 'Construction',
    blurb: 'A general contractor’s project-controls agent. RFIs, submittals, change orders, schedule, cost and jobsite safety across five sample projects.',
    tryAsking: 'Which RFIs are overdue on Lakeview, and what is driving the schedule slip?',
  },
  {
    slug: 'lancaster-investments',
    industry: 'Investment management',
    blurb: 'Portfolio intelligence for an investment firm. Performance attribution, risk monitoring and policy-limit compliance across two sample portfolios.',
    tryAsking: 'Are we in breach of any policy limits in the Growth fund, and what action is required?',
  },
  {
    slug: 'demo',
    industry: 'Any (blank studio and guide)',
    blurb: 'The demo guide and a blank studio. Ask what demos exist and what each one has, or load your own skills and connect an MCP server.',
    tryAsking: 'Which demo fits a construction company, and what can it do?',
  },
]

export interface ExternalDemo {
  slug: string
  name: string
  industry: string
  blurb: string
  url: string
  mcpUrl: string
  tools: { name: string; does: string }[]
}

// Demos that live outside this app. The retinal agent is a standalone MCP server with its own page.
export const EXTERNAL_DEMOS: ExternalDemo[] = [
  {
    slug: 'retinal-image-quality',
    name: 'Retinal Image Quality Agent',
    industry: 'Clinical research / ophthalmology',
    blurb: 'Checks retinal (fundus) images for diagnostic quality at upload and returns ACCEPT, REVIEW or REJECT, so bad images are caught before a human grader sees them. An MCP server with a try-it page.',
    url: 'https://data-quality-agent-2.vercel.app',
    mcpUrl: 'https://data-quality-agent-2.vercel.app/mcp',
    tools: [
      { name: 'tool_check_image_quality', does: 'Runs every check and returns one verdict plus the full report (primary tool)' },
      { name: 'tool_check_sharpness', does: 'Blur detection' },
      { name: 'tool_check_resolution', does: 'Image size against the minimum' },
      { name: 'tool_check_format', does: 'File format and corruption' },
      { name: 'tool_check_illumination', does: 'Brightness, uniformity and vignetting' },
      { name: 'tool_check_color', does: 'Color profile' },
      { name: 'tool_validate_metadata', does: 'EXIF metadata' },
      { name: 'tool_assess_fundus_quality', does: 'EyeQ deep-learning grade (runs locally, not on the hosted page)' },
    ],
  },
]
