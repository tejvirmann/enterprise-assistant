// Construction project-controls tools for the Findorff Demo: projects, RFIs, submittals, change orders,
// schedule milestones, cost, and jobsite safety. All data is fictional sample data (see scripts/industry-demos.ts).

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'

const s = (v: string | undefined) => v ?? ''

export const projectTools = {
  proj_list_projects: tool({
    description:
      'List construction projects with owner, project manager, contract value, percent complete, status and substantial-completion date. status: optional, e.g. "Active", "Preconstruction", "Closeout".',
    parameters: z.object({ status: z.string().optional().default('') }),
    execute: async ({ status }) => {
      const rows = await sql`
        SELECT id, name, project_type, owner, project_manager, superintendent, contract_value,
               percent_complete, status, start_date, substantial_completion
        FROM con_projects
        WHERE (${s(status)} = '' OR status ILIKE ${s(status)})
        ORDER BY name`
      return JSON.stringify(rows)
    },
  }),

  proj_get_project: tool({
    description:
      'One-page health summary for a project: contract value, percent complete, and counts of open/overdue RFIs, late submittals, pending change orders (with dollar total), slipping milestones, and open safety items. project: id or partial name.',
    parameters: z.object({ project: z.string() }),
    execute: async ({ project }) => {
      const p = await sql`SELECT * FROM con_projects WHERE id ILIKE ${project} OR name ILIKE ${'%' + project + '%'} LIMIT 1`
      if (!p.length) return JSON.stringify({ error: `No project matching "${project}"` })
      const id = p[0].id as string
      const [rfi, sub, co, ms, saf] = await Promise.all([
        sql`SELECT count(*) FILTER (WHERE status = 'Open') AS open,
                   count(*) FILTER (WHERE status = 'Open' AND due_date < CURRENT_DATE) AS overdue
            FROM con_rfis WHERE project_id = ${id}`,
        sql`SELECT count(*) FILTER (WHERE status IN ('Not Submitted','Pending Review','Revise & Resubmit') AND required_by < CURRENT_DATE) AS late,
                   count(*) FILTER (WHERE status IN ('Not Submitted','Pending Review','Revise & Resubmit')) AS outstanding
            FROM con_submittals WHERE project_id = ${id}`,
        sql`SELECT count(*) FILTER (WHERE status = 'Pending') AS pending, coalesce(sum(amount) FILTER (WHERE status = 'Pending'), 0) AS pending_amount
            FROM con_change_orders WHERE project_id = ${id}`,
        sql`SELECT count(*) FILTER (WHERE forecast_date > planned_date) AS slipping FROM con_milestones WHERE project_id = ${id} AND status <> 'Complete'`,
        sql`SELECT count(*) FILTER (WHERE status = 'Open') AS open_items FROM con_safety WHERE project_id = ${id}`,
      ])
      return JSON.stringify({ project: p[0], rfis: rfi[0], submittals: sub[0], change_orders: co[0], milestones: ms[0], safety: saf[0] })
    },
  }),

  proj_get_rfis: tool({
    description:
      'Requests for Information. project: optional id/partial name. status: "Open" (awaiting a response), "Answered" or "Closed". overdue_only: true returns only Open RFIs past their due date. Includes days_open, ball-in-court, and cost/schedule impact flags.',
    parameters: z.object({
      project: z.string().optional().default(''),
      status: z.string().optional().default(''),
      overdue_only: z.boolean().optional().default(false),
    }),
    execute: async ({ project, status, overdue_only }) => {
      const rows = await sql`
        SELECT r.number, p.name AS project, r.subject, r.discipline, r.status, r.ball_in_court,
               r.submitted_date, r.due_date, (CURRENT_DATE - r.submitted_date) AS days_open,
               (r.status = 'Open' AND r.due_date < CURRENT_DATE) AS overdue,
               r.cost_impact, r.schedule_impact
        FROM con_rfis r JOIN con_projects p ON p.id = r.project_id
        WHERE (${s(project)} = '' OR p.id ILIKE ${s(project)} OR p.name ILIKE ${'%' + project + '%'})
          AND (${s(status)} = '' OR r.status ILIKE ${s(status)})
          AND (${overdue_only} = false OR (r.status = 'Open' AND r.due_date < CURRENT_DATE))
        ORDER BY r.due_date`
      return JSON.stringify(rows)
    },
  }),

  proj_get_submittals: tool({
    description:
      'Submittal log. project: optional. status: "Approved", "Pending Review", "Revise & Resubmit" or "Not Submitted". late_only: true returns outstanding submittals past their required-by date. Includes lead_time_weeks so you can judge risk to procurement and schedule.',
    parameters: z.object({
      project: z.string().optional().default(''),
      status: z.string().optional().default(''),
      late_only: z.boolean().optional().default(false),
    }),
    execute: async ({ project, status, late_only }) => {
      const rows = await sql`
        SELECT u.id, p.name AS project, u.spec_section, u.description, u.subcontractor, u.status,
               u.submitted_date, u.required_by, u.lead_time_weeks,
               (u.status <> 'Approved' AND u.required_by < CURRENT_DATE) AS late,
               (CURRENT_DATE - u.required_by) AS days_late
        FROM con_submittals u JOIN con_projects p ON p.id = u.project_id
        WHERE (${s(project)} = '' OR p.id ILIKE ${s(project)} OR p.name ILIKE ${'%' + project + '%'})
          AND (${s(status)} = '' OR u.status ILIKE ${s(status)})
          AND (${late_only} = false OR (u.status <> 'Approved' AND u.required_by < CURRENT_DATE))
        ORDER BY u.required_by`
      return JSON.stringify(rows)
    },
  }),

  proj_get_change_orders: tool({
    description:
      'Change orders and potential changes. project: optional. status: "Pending", "Approved" or "Rejected". Returns amount, reason (owner change, unforeseen condition, design error, etc.) and dates. Sum the amounts for exposure.',
    parameters: z.object({ project: z.string().optional().default(''), status: z.string().optional().default('') }),
    execute: async ({ project, status }) => {
      const rows = await sql`
        SELECT c.co_number, p.name AS project, c.description, c.reason, c.amount, c.status, c.submitted_date,
               (CURRENT_DATE - c.submitted_date) AS days_pending
        FROM con_change_orders c JOIN con_projects p ON p.id = c.project_id
        WHERE (${s(project)} = '' OR p.id ILIKE ${s(project)} OR p.name ILIKE ${'%' + project + '%'})
          AND (${s(status)} = '' OR c.status ILIKE ${s(status)})
        ORDER BY c.submitted_date DESC`
      return JSON.stringify(rows)
    },
  }),

  proj_get_milestones: tool({
    description:
      'Schedule milestones with planned vs forecast dates and slip in days. project: optional. slipping_only: true returns only incomplete milestones forecast later than planned. Each row names the driver of any slip.',
    parameters: z.object({ project: z.string().optional().default(''), slipping_only: z.boolean().optional().default(false) }),
    execute: async ({ project, slipping_only }) => {
      const rows = await sql`
        SELECT p.name AS project, m.name AS milestone, m.planned_date, m.forecast_date,
               (m.forecast_date - m.planned_date) AS slip_days, m.status, m.driver
        FROM con_milestones m JOIN con_projects p ON p.id = m.project_id
        WHERE (${s(project)} = '' OR p.id ILIKE ${s(project)} OR p.name ILIKE ${'%' + project + '%'})
          AND (${slipping_only} = false OR (m.status <> 'Complete' AND m.forecast_date > m.planned_date))
        ORDER BY m.planned_date`
      return JSON.stringify(rows)
    },
  }),

  proj_get_cost_summary: tool({
    description:
      'Budget vs committed vs actual vs forecast by cost code for a project, with projected variance (forecast minus budget; positive means over budget) and totals. project: id or partial name.',
    parameters: z.object({ project: z.string() }),
    execute: async ({ project }) => {
      const p = await sql`SELECT id, name FROM con_projects WHERE id ILIKE ${project} OR name ILIKE ${'%' + project + '%'} LIMIT 1`
      if (!p.length) return JSON.stringify({ error: `No project matching "${project}"` })
      const lines = await sql`
        SELECT cost_code, description, budget, committed, actual_to_date, forecast_final,
               (forecast_final - budget) AS projected_variance
        FROM con_budget WHERE project_id = ${p[0].id} ORDER BY cost_code`
      const totals = await sql`
        SELECT sum(budget) AS budget, sum(committed) AS committed, sum(actual_to_date) AS actual,
               sum(forecast_final) AS forecast, sum(forecast_final - budget) AS projected_variance
        FROM con_budget WHERE project_id = ${p[0].id}`
      return JSON.stringify({ project: p[0].name, lines, totals: totals[0] })
    },
  }),

  safety_get_incidents: tool({
    description:
      'Jobsite safety log: near misses, first-aid cases, recordables and observations. project: optional. type: "Near miss", "First aid", "Recordable" or "Observation". date_from: YYYY-MM-DD. open_only: true returns items whose corrective action is not closed.',
    parameters: z.object({
      project: z.string().optional().default(''),
      type: z.string().optional().default(''),
      date_from: z.string().optional().default(''),
      open_only: z.boolean().optional().default(false),
    }),
    execute: async ({ project, type, date_from, open_only }) => {
      const rows = await sql`
        SELECT p.name AS project, f.event_date, f.event_type, f.trade, f.description, f.corrective_action, f.status
        FROM con_safety f JOIN con_projects p ON p.id = f.project_id
        WHERE (${s(project)} = '' OR p.id ILIKE ${s(project)} OR p.name ILIKE ${'%' + project + '%'})
          AND (${s(type)} = '' OR f.event_type ILIKE ${s(type)})
          AND (NULLIF(${s(date_from)}, '') IS NULL OR f.event_date >= NULLIF(${s(date_from)}, '')::date)
          AND (${open_only} = false OR f.status = 'Open')
        ORDER BY f.event_date DESC`
      return JSON.stringify(rows)
    },
  }),

  safety_get_summary: tool({
    description:
      'Safety rollup across projects: counts by event type, trade with the most events, and open corrective actions. Useful for a weekly safety review. date_from: optional YYYY-MM-DD.',
    parameters: z.object({ date_from: z.string().optional().default('') }),
    execute: async ({ date_from }) => {
      const byProject = await sql`
        SELECT p.name AS project,
               count(*) FILTER (WHERE f.event_type = 'Recordable') AS recordables,
               count(*) FILTER (WHERE f.event_type = 'First aid') AS first_aid,
               count(*) FILTER (WHERE f.event_type = 'Near miss') AS near_misses,
               count(*) FILTER (WHERE f.event_type = 'Observation') AS observations,
               count(*) FILTER (WHERE f.status = 'Open') AS open_corrective_actions
        FROM con_projects p LEFT JOIN con_safety f ON f.project_id = p.id AND (NULLIF(${s(date_from)}, '') IS NULL OR f.event_date >= NULLIF(${s(date_from)}, '')::date)
        GROUP BY p.name ORDER BY p.name`
      const byTrade = await sql`
        SELECT trade, count(*) AS events FROM con_safety WHERE (NULLIF(${s(date_from)}, '') IS NULL OR event_date >= NULLIF(${s(date_from)}, '')::date)
        GROUP BY trade ORDER BY events DESC LIMIT 5`
      return JSON.stringify({ by_project: byProject, top_trades: byTrade })
    },
  }),
}
