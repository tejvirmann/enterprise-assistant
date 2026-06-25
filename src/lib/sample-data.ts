import { sql } from './db'
import { getEffectiveToolIds } from './presets'

const ROW_LIMIT = 50

export async function getSampleData(companyId: string): Promise<Record<string, Record<string, Record<string, unknown>[]>>> {
  const toolIds = await getEffectiveToolIds(companyId)
  const groups = new Set(toolIds.map((id) => id.split('_')[0]))

  const data: Record<string, Record<string, Record<string, unknown>[]>> = {}

  if (groups.has('lims')) {
    data.lims = {
      compounds: await sql`SELECT * FROM lims_compounds ORDER BY id LIMIT ${ROW_LIMIT}`,
      samples: await sql`SELECT * FROM lims_samples ORDER BY id LIMIT ${ROW_LIMIT}`,
      results: await sql`SELECT * FROM lims_results ORDER BY id LIMIT ${ROW_LIMIT}`,
    }
  }
  if (groups.has('qms')) {
    data.qms = {
      products: await sql`SELECT * FROM qms_products ORDER BY id LIMIT ${ROW_LIMIT}`,
      batches: await sql`SELECT * FROM qms_batches ORDER BY id LIMIT ${ROW_LIMIT}`,
      deviations: await sql`SELECT * FROM qms_deviations ORDER BY id LIMIT ${ROW_LIMIT}`,
      capas: await sql`SELECT * FROM qms_capas ORDER BY id LIMIT ${ROW_LIMIT}`,
    }
  }
  if (groups.has('rosetta')) {
    data.rosetta = {
      term_map: await sql`SELECT * FROM rosetta_term_map ORDER BY id LIMIT ${ROW_LIMIT}`,
      unit_conversions: await sql`SELECT * FROM rosetta_unit_conversions ORDER BY id LIMIT ${ROW_LIMIT}`,
      compound_aliases: await sql`SELECT * FROM rosetta_compound_aliases ORDER BY id LIMIT ${ROW_LIMIT}`,
    }
  }

  return data
}
