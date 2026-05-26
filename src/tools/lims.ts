// LIMS tools — translated from lattice-poc/mcp-servers/lims_mcp.py
// Same query logic, same tool descriptions. Hits Neon Postgres instead of SQLite.

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'

export const limsTools = {
  lims_list_compounds: tool({
    description: 'List all compounds tracked in LIMS with drug class and target.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await sql`SELECT * FROM lims_compounds ORDER BY name`
      return JSON.stringify(rows)
    },
  }),

  lims_search_samples: tool({
    description:
      'Search LIMS samples. All filters optional. compound_name: partial match. matrix: e.g. "Drug Substance". date_from/date_to: YYYY-MM-DD.',
    parameters: z.object({
      compound_name: z.string().optional().default(''),
      matrix: z.string().optional().default(''),
      date_from: z.string().optional().default(''),
      date_to: z.string().optional().default(''),
    }),
    execute: async ({ compound_name, matrix, date_from, date_to }) => {
      const rows = await sql`
        SELECT s.id, c.name AS compound, s.name AS sample_name,
               s.matrix, s.concentration_mg_ml, s.storage_temp,
               s.analyst, s.created_at
        FROM lims_samples s
        JOIN lims_compounds c ON s.compound_id = c.id
        WHERE (${compound_name} = '' OR c.name ILIKE ${'%' + compound_name + '%'})
          AND (${matrix} = '' OR s.matrix ILIKE ${'%' + matrix + '%'})
          AND (${date_from} = '' OR s.created_at >= ${date_from})
          AND (${date_to} = '' OR s.created_at <= ${date_to})
        ORDER BY s.created_at DESC
      `
      return JSON.stringify(rows)
    },
  }),

  lims_get_assay_results: tool({
    description:
      'Retrieve analytical results from LIMS. sample_name: partial match. compound_name: filter by compound. assay_name: e.g. "HPLC Purity". pass_fail: "Pass" or "Fail".',
    parameters: z.object({
      sample_name: z.string().optional().default(''),
      compound_name: z.string().optional().default(''),
      assay_name: z.string().optional().default(''),
      pass_fail: z.string().optional().default(''),
    }),
    execute: async ({ sample_name, compound_name, assay_name, pass_fail }) => {
      const rows = await sql`
        SELECT r.id, c.name AS compound, s.name AS sample_name,
               a.name AS assay, r.value, r.unit, r.pass_fail,
               r.analyst, r.run_date, r.notes, a.method
        FROM lims_results r
        JOIN lims_samples s   ON r.sample_id  = s.id
        JOIN lims_compounds c ON s.compound_id = c.id
        JOIN lims_assays a    ON r.assay_id    = a.id
        WHERE (${sample_name} = '' OR s.name ILIKE ${'%' + sample_name + '%'})
          AND (${compound_name} = '' OR c.name ILIKE ${'%' + compound_name + '%'})
          AND (${assay_name} = '' OR a.name ILIKE ${'%' + assay_name + '%'})
          AND (${pass_fail} = '' OR r.pass_fail = ${pass_fail})
        ORDER BY r.run_date DESC
      `
      return JSON.stringify(rows)
    },
  }),

  lims_get_oos_results: tool({
    description:
      'Get all out-of-spec (OOS/Fail) results. Optionally filter by date range (YYYY-MM-DD). Use for deviation investigations.',
    parameters: z.object({
      date_from: z.string().optional().default(''),
      date_to: z.string().optional().default(''),
    }),
    execute: async ({ date_from, date_to }) => {
      const rows = await sql`
        SELECT r.id, c.name AS compound, s.name AS sample_name,
               a.name AS assay, r.value, r.unit, r.analyst, r.run_date
        FROM lims_results r
        JOIN lims_samples s   ON r.sample_id  = s.id
        JOIN lims_compounds c ON s.compound_id = c.id
        JOIN lims_assays a    ON r.assay_id    = a.id
        WHERE r.pass_fail = 'Fail'
          AND (${date_from} = '' OR r.run_date >= ${date_from})
          AND (${date_to} = '' OR r.run_date <= ${date_to})
        ORDER BY r.run_date DESC
      `
      return JSON.stringify(rows)
    },
  }),

  lims_get_instrument_status: tool({
    description:
      'List all analytical instruments with calibration status. Flags overdue or imminent calibration.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await sql`SELECT * FROM lims_instruments ORDER BY calibration_due`
      return JSON.stringify(rows)
    },
  }),

  lims_compare_compound_results: tool({
    description:
      'Compare assay results across all samples for a compound. Returns min, max, mean, pass rate, and individual results. Use for cross-batch trends.',
    parameters: z.object({
      compound_name: z.string(),
      assay_name: z.string(),
    }),
    execute: async ({ compound_name, assay_name }) => {
      const rows = await sql`
        SELECT s.name AS sample_name, s.matrix, r.value, r.unit,
               r.pass_fail, r.run_date
        FROM lims_results r
        JOIN lims_samples s   ON r.sample_id  = s.id
        JOIN lims_compounds c ON s.compound_id = c.id
        JOIN lims_assays a    ON r.assay_id    = a.id
        WHERE c.name ILIKE ${'%' + compound_name + '%'}
          AND a.name ILIKE ${'%' + assay_name + '%'}
        ORDER BY r.run_date
      `
      if (!rows.length) {
        return JSON.stringify({ error: 'No results found', compound_name, assay_name })
      }
      const values = rows.map((r: { value: number }) => r.value).filter((v: number) => v !== null)
      const passes = rows.filter((r: { pass_fail: string }) => r.pass_fail === 'Pass').length
      return JSON.stringify({
        compound: compound_name,
        assay: assay_name,
        n: rows.length,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        mean: values.length ? values.reduce((a: number, b: number) => a + b, 0) / values.length : null,
        pass_rate_pct: Math.round((passes / rows.length) * 1000) / 10,
        results: rows,
      })
    },
  }),
}
