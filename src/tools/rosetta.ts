// Rosetta tools — translated from lattice-poc/mcp-servers/rosetta_mcp.py

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'

export const rosettaTools = {
  rosetta_normalize_term: tool({
    description:
      'Normalize a term from any system to its canonical form. term: e.g. "HPLC Purity". source_system: optional, e.g. "LIMS". Returns canonical term and ontology code.',
    parameters: z.object({
      term: z.string(),
      source_system: z.string().optional().default(''),
    }),
    execute: async ({ term, source_system }) => {
      const rows = await sql`
        SELECT * FROM rosetta_term_map
        WHERE source_term ILIKE ${'%' + term + '%'}
          AND (${source_system} = '' OR source_system = ${source_system})
      `
      return JSON.stringify(rows)
    },
  }),

  rosetta_convert_units: tool({
    description:
      'Convert a numeric value between units. from_unit/to_unit: e.g. "mg/mL" → "g/L". Returns converted value.',
    parameters: z.object({
      value: z.number(),
      from_unit: z.string(),
      to_unit: z.string(),
    }),
    execute: async ({ value, from_unit, to_unit }) => {
      const rows = await sql`
        SELECT * FROM rosetta_unit_conversions
        WHERE from_unit = ${from_unit} AND to_unit = ${to_unit}
      `
      if (!rows.length) {
        return JSON.stringify({ error: `No conversion defined from ${from_unit} to ${to_unit}` })
      }
      const row = rows[0] as { factor: number; addend: number }
      return JSON.stringify({
        input_value: value,
        input_unit: from_unit,
        output_value: Math.round((value * row.factor + row.addend) * 1e6) / 1e6,
        output_unit: to_unit,
        factor: row.factor,
      })
    },
  }),

  rosetta_resolve_compound: tool({
    description:
      'Resolve a compound alias to its canonical name. alias: name as used in a source system, e.g. "Nexivab". Returns canonical LIMS name.',
    parameters: z.object({
      alias: z.string(),
      source_system: z.string().optional().default(''),
    }),
    execute: async ({ alias, source_system }) => {
      const rows = await sql`
        SELECT * FROM rosetta_compound_aliases
        WHERE alias ILIKE ${'%' + alias + '%'}
          AND (${source_system} = '' OR source_system = ${source_system})
      `
      return JSON.stringify(rows)
    },
  }),

  rosetta_list_term_mappings: tool({
    description:
      'List all term mappings, optionally filtered by source system. Shows how each system\'s terminology maps to canonical terms.',
    parameters: z.object({
      source_system: z.string().optional().default(''),
    }),
    execute: async ({ source_system }) => {
      const rows = await sql`
        SELECT * FROM rosetta_term_map
        WHERE (${source_system} = '' OR source_system = ${source_system})
        ORDER BY source_system, canonical_term
      `
      return JSON.stringify(rows)
    },
  }),

  rosetta_standardize_status: tool({
    description:
      'Convert a system-specific status to its canonical meaning. e.g. QMS "Released" → "Conforming", LIMS "Pass" → "Conforming". Essential when comparing across systems.',
    parameters: z.object({
      status: z.string(),
      source_system: z.string(),
    }),
    execute: async ({ status, source_system }) => {
      const rows = await sql`
        SELECT * FROM rosetta_term_map
        WHERE source_term = ${status} AND source_system = ${source_system}
      `
      if (!rows.length) {
        return JSON.stringify({
          input: status,
          system: source_system,
          canonical: status,
          note: 'No mapping found — using original',
        })
      }
      return JSON.stringify(rows[0])
    },
  }),
}
