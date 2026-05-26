// QMS tools — translated from lattice-poc/mcp-servers/qms_mcp.py

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'

export const qmsTools = {
  qms_list_products: tool({
    description: 'List all products in the QMS with formulation and indication.',
    parameters: z.object({}),
    execute: async () => {
      const rows = await sql`SELECT * FROM qms_products ORDER BY name`
      return JSON.stringify(rows)
    },
  }),

  qms_get_batch: tool({
    description: 'Retrieve a batch record by lot number. Returns batch details and current status.',
    parameters: z.object({ lot_number: z.string() }),
    execute: async ({ lot_number }) => {
      const rows = await sql`
        SELECT b.*, p.name AS product_name, p.formulation_type, p.strength
        FROM qms_batches b
        JOIN qms_products p ON b.product_id = p.id
        WHERE b.lot_number ILIKE ${'%' + lot_number + '%'}
      `
      return JSON.stringify(rows)
    },
  }),

  qms_list_batches: tool({
    description:
      'List batches with optional filters. product_name: partial match. status: "Released", "In Review", "On Hold". date_from/date_to: manufacture date range YYYY-MM-DD.',
    parameters: z.object({
      product_name: z.string().optional().default(''),
      status: z.string().optional().default(''),
      date_from: z.string().optional().default(''),
      date_to: z.string().optional().default(''),
    }),
    execute: async ({ product_name, status, date_from, date_to }) => {
      const rows = await sql`
        SELECT b.id, p.name AS product, b.lot_number,
               b.manufacture_date, b.expiry_date,
               b.batch_size_kg, b.status
        FROM qms_batches b
        JOIN qms_products p ON b.product_id = p.id
        WHERE (${product_name} = '' OR p.name ILIKE ${'%' + product_name + '%'})
          AND (${status} = '' OR b.status = ${status})
          AND (${date_from} = '' OR b.manufacture_date >= ${date_from})
          AND (${date_to} = '' OR b.manufacture_date <= ${date_to})
        ORDER BY b.manufacture_date DESC
      `
      return JSON.stringify(rows)
    },
  }),

  qms_get_deviations: tool({
    description:
      'Retrieve deviations from QMS. batch_lot: partial match. severity: "Minor", "Major", "Critical". status: "Open", "Closed".',
    parameters: z.object({
      batch_lot: z.string().optional().default(''),
      severity: z.string().optional().default(''),
      status: z.string().optional().default(''),
    }),
    execute: async ({ batch_lot, severity, status }) => {
      const rows = await sql`
        SELECT d.*, b.lot_number, p.name AS product
        FROM qms_deviations d
        JOIN qms_batches b  ON d.batch_id   = b.id
        JOIN qms_products p ON b.product_id = p.id
        WHERE (${batch_lot} = '' OR b.lot_number ILIKE ${'%' + batch_lot + '%'})
          AND (${severity} = '' OR d.severity = ${severity})
          AND (${status} = '' OR d.status = ${status})
        ORDER BY d.opened_date DESC
      `
      return JSON.stringify(rows)
    },
  }),

  qms_get_open_capas: tool({
    description:
      'List open CAPAs. Set overdue_only=true to see only past-due actions. Returns owner, due date, linked deviation.',
    parameters: z.object({
      overdue_only: z.boolean().optional().default(false),
    }),
    execute: async ({ overdue_only }) => {
      const today = new Date().toISOString().split('T')[0]
      const rows = await sql`
        SELECT ca.*, d.deviation_number, d.severity,
               d.description AS deviation_desc,
               b.lot_number, p.name AS product
        FROM qms_capas ca
        JOIN qms_deviations d ON ca.deviation_id = d.id
        JOIN qms_batches b    ON d.batch_id = b.id
        JOIN qms_products p   ON b.product_id = p.id
        WHERE ca.status = 'Open'
          AND (${overdue_only ? 'true' : 'false'} = 'false' OR ca.due_date < ${today})
        ORDER BY ca.due_date
      `
      return JSON.stringify(rows)
    },
  }),

  qms_get_specifications: tool({
    description:
      'Retrieve quality specifications for a product. Returns parameters with acceptance limits and test methods.',
    parameters: z.object({ product_name: z.string() }),
    execute: async ({ product_name }) => {
      const rows = await sql`
        SELECT s.*, p.name AS product_name
        FROM qms_specifications s
        JOIN qms_products p ON s.product_id = p.id
        WHERE p.name ILIKE ${'%' + product_name + '%'}
        ORDER BY s.parameter
      `
      return JSON.stringify(rows)
    },
  }),

  qms_check_batch_release: tool({
    description:
      'Check if a batch is ready for release. Returns batch status, open deviations, and open CAPAs. Use for batch release decisions.',
    parameters: z.object({ lot_number: z.string() }),
    execute: async ({ lot_number }) => {
      const batches = await sql`
        SELECT b.*, p.name AS product_name
        FROM qms_batches b JOIN qms_products p ON b.product_id = p.id
        WHERE b.lot_number ILIKE ${'%' + lot_number + '%'}
      `
      if (!batches.length) {
        return JSON.stringify({ error: `No batch found for lot ${lot_number}` })
      }
      const batch = batches[0] as { id: number; status: string }
      const openDevs = await sql`
        SELECT deviation_number, severity, description, status
        FROM qms_deviations WHERE batch_id = ${batch.id} AND status = 'Open'
      `
      const openCapas = await sql`
        SELECT ca.capa_number, ca.action_description, ca.owner, ca.due_date
        FROM qms_capas ca JOIN qms_deviations d ON ca.deviation_id = d.id
        WHERE d.batch_id = ${batch.id} AND ca.status = 'Open'
      `
      return JSON.stringify({
        batch,
        release_status: batch.status,
        open_deviations: openDevs,
        open_capas: openCapas,
        release_blocked: openDevs.length > 0 || batch.status === 'On Hold',
      })
    },
  }),

  qms_get_audit_findings: tool({
    description: 'List audit findings, optionally filtered by date range (YYYY-MM-DD).',
    parameters: z.object({
      date_from: z.string().optional().default(''),
      date_to: z.string().optional().default(''),
    }),
    execute: async ({ date_from, date_to }) => {
      const rows = await sql`
        SELECT * FROM qms_audits
        WHERE (${date_from} = '' OR date >= ${date_from})
          AND (${date_to} = '' OR date <= ${date_to})
        ORDER BY date DESC
      `
      return JSON.stringify(rows)
    },
  }),
}
