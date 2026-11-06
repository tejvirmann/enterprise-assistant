// Make /demo the demo guide + blank studio (a Demo Guide skill and two demo tools; no LIMS/QMS, no data tools).
// Targeted and non-destructive: it only touches the `demo` company, never other rows (e.g. `osce`).
//
//   npm run db:migrate-demos                 dry run: shows what would change, writes a backup, changes nothing
//   npm run db:migrate-demos -- --stage      add the Demo Guide skill and demo tools DISABLED (inert; for testing
//                                            before the new code is deployed)
//   npm run db:migrate-demos -- --apply      do it (run AFTER the new code is deployed)
//   npm run db:migrate-demos -- --restore scripts/backups/demo-<timestamp>.json   undo

import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { DEMO_BASE_CONTEXT, DEMO_BRAND, DEMO_DESCRIPTION, DEMO_MODULES, DEMO_TOOLS } from './demo-config'

const sql = neon(process.env.DATABASE_URL!)
const apply = process.argv.includes('--apply')
const stage = process.argv.includes('--stage')
const restoreIdx = process.argv.indexOf('--restore')

async function snapshot() {
  return {
    taken_at: new Date().toISOString(),
    company: (await sql`SELECT * FROM companies WHERE id = 'demo'`)[0] ?? null,
    persona_modules: await sql`SELECT * FROM persona_modules WHERE persona_id = 'demo-default' ORDER BY id`,
    company_tools: await sql`SELECT * FROM company_tools WHERE company_id = 'demo' ORDER BY id`,
    company_repos: await sql`SELECT * FROM company_repos WHERE company_id = 'demo'`,
  }
}

async function restore(file: string) {
  const b = JSON.parse(readFileSync(file, 'utf8'))
  if (!b.company) throw new Error('Backup has no demo company row')
  await sql`UPDATE companies SET description = ${b.company.description}, base_context = ${b.company.base_context},
            brand_config = ${JSON.stringify(b.company.brand_config)}::jsonb WHERE id = 'demo'`
  await sql`DELETE FROM persona_modules WHERE persona_id = 'demo-default'`
  for (const m of b.persona_modules) {
    await sql`INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content)
              VALUES (${m.persona_id}, ${m.repo_id}, ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${m.enabled}, ${m.content})`
  }
  await sql`DELETE FROM company_tools WHERE company_id = 'demo'`
  for (const t of b.company_tools) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled) VALUES ('demo', ${t.tool_id}, ${t.enabled})`
  }
  console.log(`Restored demo from ${file}`)
}

async function upsertModules(enabled: boolean) {
  for (const m of DEMO_MODULES) {
    const existing = await sql`SELECT id FROM persona_modules WHERE persona_id = 'demo-default' AND name = ${m.name}`
    if (existing.length) {
      await sql`UPDATE persona_modules SET type = ${m.type}, description = ${m.description}, tokens = ${m.tokens}, content = ${m.content},
                path = ${m.path}, enabled = ${enabled} WHERE persona_id = 'demo-default' AND name = ${m.name}`
    } else {
      await sql`INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content)
                VALUES ('demo-default', 'local', ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${enabled}, ${m.content})`
    }
  }
}

async function main() {
  if (restoreIdx > -1) return restore(process.argv[restoreIdx + 1])

  const before = await snapshot()
  if (!before.company) throw new Error("No `demo` company in this database; nothing to migrate.")

  console.log('Current /demo:')
  console.log(`  skills/modules : ${before.persona_modules.map((m: any) => m.name).join(', ') || '(none)'}`)
  console.log(`  enabled tools  : ${before.company_tools.filter((t: any) => t.enabled).length}`)
  console.log('After migration:')
  console.log(`  skills/modules : ${DEMO_MODULES.map((m) => m.name).join(', ')}`)
  console.log(`  enabled tools  : ${DEMO_TOOLS.length} (${DEMO_TOOLS.join(', ')})`)
  console.log('Other companies (lattice, findorff, lancaster-investments, osce, ...) are not touched.\n')

  mkdirSync('scripts/backups', { recursive: true })
  const file = `scripts/backups/demo-${before.taken_at.replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify(before, null, 2))
  console.log(`Backup written to ${file}`)

  if (stage && !apply) {
    await upsertModules(false)
    for (const id of DEMO_TOOLS) {
      await sql`INSERT INTO company_tools (company_id, tool_id, enabled)
                SELECT 'demo', ${id}, false WHERE NOT EXISTS (SELECT 1 FROM company_tools WHERE company_id = 'demo' AND tool_id = ${id})`
    }
    console.log('\nStaged: the Demo Guide skill and demo tools were added DISABLED. /demo is unchanged until you run --apply.')
    return
  }
  if (!apply) { console.log('\nDry run only. Re-run with --stage (inert) or --apply to make the change.'); return }

  await sql`UPDATE companies SET description = ${DEMO_DESCRIPTION}, base_context = ${DEMO_BASE_CONTEXT},
            brand_config = ${DEMO_BRAND}::jsonb WHERE id = 'demo'`
  await sql`DELETE FROM persona_modules WHERE persona_id = 'demo-default' AND name <> ALL (${DEMO_MODULES.map((m) => m.name)})`
  await upsertModules(true)
  await sql`DELETE FROM company_tools WHERE company_id = 'demo' AND tool_id <> ALL (${DEMO_TOOLS})`
  for (const id of DEMO_TOOLS) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled)
              SELECT 'demo', ${id}, true WHERE NOT EXISTS (SELECT 1 FROM company_tools WHERE company_id = 'demo' AND tool_id = ${id})`
  }
  await sql`UPDATE company_tools SET enabled = true WHERE company_id = 'demo'`
  await sql`DELETE FROM company_repos WHERE company_id = 'demo'`
  await sql`UPDATE personas SET description = 'Demo guide: knows every demo and what each contains' WHERE id = 'demo-default'`
  console.log('Done. /demo is now the demo guide and blank studio.')
}

main().catch(e => { console.error(e); process.exit(1) })
