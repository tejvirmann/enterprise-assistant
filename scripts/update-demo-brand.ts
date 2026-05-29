// One-shot: update demo company to MadStack orange theme + logo
// Run: npx tsx scripts/update-demo-brand.ts
import { sql } from '../src/lib/db'

const brand = JSON.stringify({
  tagline: 'by MadStack',
  chat_welcome: 'AgentOS ready. What would you like to explore?',
  logo_url: '/madstack-icon.svg',
})

async function run() {
  await sql`
    UPDATE companies
    SET color = '#f97316',
        brand_config = ${brand}::jsonb
    WHERE id = 'demo'
  `
  console.log('Demo company updated: orange theme + MadStack logo')
  process.exit(0)
}

run()
