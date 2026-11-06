// Give the Findorff Demo (construction) and Lancaster (investments) demos tools and skills that fit them.
// Targeted and non-destructive: touches only those two companies (never lattice, demo, osce, ...).
//
//   npm run db:migrate-industry                     stage: create tables + sample data, add new tools/skills DISABLED
//                                                   (inert for the live site, safe before deploying)
//   npm run db:migrate-industry -- --activate       switch both companies over (run AFTER the new code is deployed)
//   npm run db:migrate-industry -- --restore scripts/backups/industry-<timestamp>.json   undo --activate

import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { activate, stage } from './industry-demos'

const sql = neon(process.env.DATABASE_URL!)
const IDS = ['findorff', 'lancaster-investments']
const PERSONAS = ['findorff-default', 'lancaster-portfolio']

async function snapshot() {
  return {
    taken_at: new Date().toISOString(),
    companies: await sql`SELECT * FROM companies WHERE id = ANY(${IDS})`,
    personas: await sql`SELECT * FROM personas WHERE id = ANY(${PERSONAS})`,
    persona_modules: await sql`SELECT * FROM persona_modules WHERE persona_id = ANY(${PERSONAS}) ORDER BY id`,
    company_tools: await sql`SELECT * FROM company_tools WHERE company_id = ANY(${IDS}) ORDER BY id`,
    company_repos: await sql`SELECT * FROM company_repos WHERE company_id = ANY(${IDS})`,
  }
}

async function restore(file: string) {
  const b = JSON.parse(readFileSync(file, 'utf8'))
  for (const c of b.companies) {
    await sql`UPDATE companies SET name = ${c.name}, description = ${c.description}, color = ${c.color}, base_context = ${c.base_context},
              brand_config = ${JSON.stringify(c.brand_config)}::jsonb WHERE id = ${c.id}`
  }
  for (const p of b.personas) await sql`UPDATE personas SET name = ${p.name}, description = ${p.description} WHERE id = ${p.id}`
  await sql`DELETE FROM persona_modules WHERE persona_id = ANY(${PERSONAS})`
  for (const m of b.persona_modules) {
    await sql`INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content)
              VALUES (${m.persona_id}, ${m.repo_id}, ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${m.enabled}, ${m.content})`
  }
  await sql`DELETE FROM company_tools WHERE company_id = ANY(${IDS})`
  for (const t of b.company_tools) await sql`INSERT INTO company_tools (company_id, tool_id, enabled) VALUES (${t.company_id}, ${t.tool_id}, ${t.enabled})`
  await sql`DELETE FROM company_repos WHERE company_id = ANY(${IDS})`
  for (const r of b.company_repos) await sql`INSERT INTO company_repos (company_id, repo_id) VALUES (${r.company_id}, ${r.repo_id})`
  console.log(`Restored findorff and lancaster-investments from ${file}`)
}

async function main() {
  const i = process.argv.indexOf('--restore')
  if (i > -1) return restore(process.argv[i + 1])

  const before = await snapshot()
  mkdirSync('scripts/backups', { recursive: true })
  const file = `scripts/backups/industry-${before.taken_at.replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify(before, null, 2))
  console.log(`Backup written to ${file}`)

  console.log('Staging: creating tables and sample data, adding new tools/skills (disabled)...')
  await stage(sql)
  console.log('Staged. The live demos are unchanged until you activate.')

  if (process.argv.includes('--activate')) {
    await activate(sql)
    console.log('Activated: Findorff Demo is now a construction project-controls agent; Lancaster has portfolio tools.')
  } else {
    console.log('To switch over (after deploying this code): npm run db:migrate-industry -- --activate')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
