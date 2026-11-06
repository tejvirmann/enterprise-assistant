// Investment portfolio tools for the Lancaster demo: holdings, performance/attribution, risk, and
// investment-policy (IPS) compliance. All data is fictional sample data (see scripts/industry-demos.ts).

import { tool } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'

type Holding = {
  ticker: string; name: string; asset_class: string; sector: string; market_value: number
  liquidity_days: number; ytd_return_pct: number; mtd_return_pct: number; start_weight_pct: number; beta: number
}

async function findPortfolio(q: string) {
  const rows = await sql`SELECT * FROM pf_portfolios WHERE id ILIKE ${q} OR name ILIKE ${'%' + q + '%'} LIMIT 1`
  return rows[0] as { id: string; name: string; benchmark: string; strategy: string } | undefined
}

async function loadHoldings(portfolioId: string): Promise<(Holding & { weight_pct: number })[]> {
  const rows = (await sql`SELECT * FROM pf_holdings WHERE portfolio_id = ${portfolioId}`).map((r) => ({
    ...r,
    market_value: Number(r.market_value), liquidity_days: Number(r.liquidity_days), ytd_return_pct: Number(r.ytd_return_pct),
    mtd_return_pct: Number(r.mtd_return_pct), start_weight_pct: Number(r.start_weight_pct), beta: Number(r.beta),
  })) as Holding[]
  const total = rows.reduce((a, r) => a + r.market_value, 0)
  return rows.map((r) => ({ ...r, weight_pct: +((r.market_value / total) * 100).toFixed(2) }))
}

const round = (n: number, d = 2) => +n.toFixed(d)
const notFound = (q: string) => JSON.stringify({ error: `No portfolio matching "${q}". Use port_list_portfolios to see the options.` })

export const portfolioTools = {
  port_list_portfolios: tool({
    description: 'List the portfolios under management with strategy, benchmark and current market value (AUM).',
    parameters: z.object({}),
    execute: async () => {
      const rows = await sql`
        SELECT p.id, p.name, p.strategy, p.benchmark, p.inception_date,
               (SELECT sum(market_value) FROM pf_holdings h WHERE h.portfolio_id = p.id) AS market_value
        FROM pf_portfolios p ORDER BY p.name`
      return JSON.stringify(rows)
    },
  }),

  port_get_holdings: tool({
    description:
      'Current holdings of a portfolio with weight, sector, asset class, YTD return and unrealized gain. portfolio: id or partial name. asset_class: optional, e.g. "Equity", "Fixed Income", "Cash". sector: optional partial match.',
    parameters: z.object({ portfolio: z.string(), asset_class: z.string().optional().default(''), sector: z.string().optional().default('') }),
    execute: async ({ portfolio, asset_class, sector }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const all = await loadHoldings(p.id)
      const costs = await sql`SELECT ticker, shares, cost_basis_per_share, price FROM pf_holdings WHERE portfolio_id = ${p.id}`
      const byTicker = new Map(costs.map((c) => [c.ticker as string, c]))
      const rows = all
        .filter((h) => (!asset_class || h.asset_class.toLowerCase() === asset_class.toLowerCase()) && (!sector || h.sector.toLowerCase().includes(sector.toLowerCase())))
        .sort((a, b) => b.weight_pct - a.weight_pct)
        .map((h) => {
          const c = byTicker.get(h.ticker)!
          return {
            ticker: h.ticker, name: h.name, asset_class: h.asset_class, sector: h.sector, market_value: h.market_value,
            weight_pct: h.weight_pct, ytd_return_pct: h.ytd_return_pct,
            unrealized_gain_pct: round((Number(c.price) / Number(c.cost_basis_per_share) - 1) * 100, 1),
          }
        })
      return JSON.stringify({ portfolio: p.name, as_of: 'latest close', holdings: rows })
    },
  }),

  port_get_performance: tool({
    description:
      'Portfolio return vs its benchmark for MTD, QTD, YTD, 1Y and 3Y (annualized), with excess return for each. portfolio: id or partial name.',
    parameters: z.object({ portfolio: z.string() }),
    execute: async ({ portfolio }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const rows = await sql`
        SELECT period, return_pct, benchmark_return_pct, round((return_pct - benchmark_return_pct)::numeric, 2) AS excess_pct
        FROM pf_performance WHERE portfolio_id = ${p.id}
        ORDER BY array_position(ARRAY['MTD','QTD','YTD','1Y','3Y'], period)`
      return JSON.stringify({ portfolio: p.name, benchmark: p.benchmark, periods: rows })
    },
  }),

  port_get_attribution: tool({
    description:
      'YTD return attribution. group_by: "position" (default), "sector" or "asset_class". Contribution (in basis points) = starting weight x return. Returns groups ranked by contribution, so the top rows are contributors and the bottom rows are detractors. top_n limits the list (default 5 contributors and 5 detractors).',
    parameters: z.object({
      portfolio: z.string(),
      group_by: z.enum(['position', 'sector', 'asset_class']).optional().default('position'),
      top_n: z.number().optional().default(5),
    }),
    execute: async ({ portfolio, group_by = 'position', top_n = 5 }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const holdings = await loadHoldings(p.id)
      const groups = new Map<string, { group: string; weight_pct: number; contribution_bps: number }>()
      for (const h of holdings) {
        const key = group_by === 'position' ? `${h.ticker} (${h.name})` : group_by === 'sector' ? h.sector : h.asset_class
        const g = groups.get(key) ?? { group: key, weight_pct: 0, contribution_bps: 0 }
        g.weight_pct += h.weight_pct
        g.contribution_bps += h.start_weight_pct * h.ytd_return_pct
        groups.set(key, g)
      }
      const ranked = [...groups.values()]
        .map((g) => ({ ...g, weight_pct: round(g.weight_pct), contribution_bps: Math.round(g.contribution_bps) }))
        .sort((a, b) => b.contribution_bps - a.contribution_bps)
      return JSON.stringify({
        portfolio: p.name, group_by, total_contribution_bps: ranked.reduce((a, g) => a + g.contribution_bps, 0),
        top_contributors: ranked.slice(0, top_n), top_detractors: ranked.slice(-top_n).reverse(),
      })
    },
  }),

  port_get_liquidity: tool({
    description:
      'Share of the portfolio that can be liquidated within 1 day, 5 days and 30 days at current market depth, plus the least liquid positions. portfolio: id or partial name.',
    parameters: z.object({ portfolio: z.string() }),
    execute: async ({ portfolio }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const hs = await loadHoldings(p.id)
      const within = (d: number) => round(hs.filter((h) => h.liquidity_days <= d).reduce((a, h) => a + h.weight_pct, 0))
      const illiquid = [...hs].sort((a, b) => b.liquidity_days - a.liquidity_days).slice(0, 3)
        .map((h) => ({ ticker: h.ticker, name: h.name, weight_pct: h.weight_pct, days_to_liquidate: h.liquidity_days }))
      return JSON.stringify({ portfolio: p.name, pct_liquid_within_1d: within(1), pct_liquid_within_5d: within(5), pct_liquid_within_30d: within(30), least_liquid: illiquid })
    },
  }),

  risk_get_metrics: tool({
    description:
      'Risk metrics for a portfolio: annualized volatility vs benchmark, 1-day VaR at 95% and 99% and 10-day VaR (% of NAV), beta, max drawdown with peak/trough dates, tracking error and Sharpe ratio. Flag 1-day 95% VaR above 1.5% of NAV. portfolio: id or partial name.',
    parameters: z.object({ portfolio: z.string() }),
    execute: async ({ portfolio }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const rows = await sql`SELECT * FROM pf_risk WHERE portfolio_id = ${p.id}`
      return JSON.stringify({ portfolio: p.name, benchmark: p.benchmark, metrics: rows[0] ?? null })
    },
  }),

  risk_get_concentration: tool({
    description:
      'Concentration analysis: ten largest positions, weight by sector and by asset class, and the effective number of positions (1 / sum of squared weights). portfolio: id or partial name.',
    parameters: z.object({ portfolio: z.string() }),
    execute: async ({ portfolio }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const hs = await loadHoldings(p.id)
      const sum = (key: 'sector' | 'asset_class') => {
        const m = new Map<string, number>()
        hs.forEach((h) => m.set(h[key], (m.get(h[key]) ?? 0) + h.weight_pct))
        return [...m.entries()].map(([name, weight_pct]) => ({ name, weight_pct: round(weight_pct) })).sort((a, b) => b.weight_pct - a.weight_pct)
      }
      const hhi = hs.reduce((a, h) => a + (h.weight_pct / 100) ** 2, 0)
      return JSON.stringify({
        portfolio: p.name,
        top_10: [...hs].sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 10).map((h) => ({ ticker: h.ticker, name: h.name, weight_pct: h.weight_pct })),
        by_sector: sum('sector'), by_asset_class: sum('asset_class'), effective_positions: round(1 / hhi, 1),
      })
    },
  }),

  ips_check_limits: tool({
    description:
      'Check a portfolio against its Investment Policy Statement (IPS). Evaluates every limit (single-name, sector, asset-class range, liquidity; single-name limits apply to individual equities, not to funds, bonds or cash) against current holdings and returns each as OK, Warning (within 90% of the limit) or Breach, with the current value, limit, severity (Hard/Soft) and the securities involved. portfolio: id or partial name.',
    parameters: z.object({ portfolio: z.string() }),
    execute: async ({ portfolio }) => {
      const p = await findPortfolio(portfolio)
      if (!p) return notFound(portfolio)
      const hs = await loadHoldings(p.id)
      const limits = await sql`SELECT * FROM pf_ips_limits WHERE portfolio_id = ${p.id} ORDER BY id`
      const weightBy = (f: (h: Holding) => boolean) => hs.filter(f).reduce((a, h) => a + h.weight_pct, 0)

      const results = limits.flatMap((l) => {
        const limit = Number(l.limit_value)
        const base = { limit: l.name, severity: l.severity, limit_value_pct: limit }
        const judge = (value: number, kind: string) => {
          const over = kind === 'max' ? value > limit : value < limit
          const near = kind === 'max' ? value > limit * 0.9 : value < limit * 1.1
          return over ? 'Breach' : near ? 'Warning' : 'OK'
        }
        if (l.scope === 'single_name') {
          return hs.filter((h) => h.asset_class === 'Equity' && h.sector !== 'Diversified').map((h) => ({ ...base, subject: `${h.ticker} (${h.name})`, current_pct: h.weight_pct, status: judge(h.weight_pct, 'max') }))
            .filter((r) => r.status !== 'OK')
        }
        if (l.scope === 'sector') {
          const sectors = [...new Set(hs.map((h) => h.sector))].filter((s) => s !== 'Cash')
          return sectors.map((s) => ({ ...base, subject: s, current_pct: round(weightBy((h) => h.sector === s)), status: judge(weightBy((h) => h.sector === s), 'max') }))
            .filter((r) => r.status !== 'OK')
        }
        if (l.scope === 'asset_class') {
          const v = weightBy((h) => h.asset_class === l.scope_value)
          return [{ ...base, subject: `${l.scope_value} (${l.limit_type})`, current_pct: round(v), status: judge(v, l.limit_type as string) }]
        }
        if (l.scope === 'liquidity') {
          const v = weightBy((h) => h.liquidity_days <= Number(l.scope_value))
          return [{ ...base, subject: `Liquid within ${l.scope_value} days (min)`, current_pct: round(v), status: judge(v, 'min') }]
        }
        return []
      })
      const breaches = results.filter((r) => r.status === 'Breach')
      return JSON.stringify({
        portfolio: p.name,
        summary: { breaches: breaches.length, warnings: results.filter((r) => r.status === 'Warning').length, hard_breaches: breaches.filter((r) => r.severity === 'Hard').length },
        findings: results,
      })
    },
  }),

  ips_get_restricted_list: tool({
    description:
      'The restricted securities list (names that may not be bought or held, for example due to conflicts or pending corporate actions), and which of them appear in each portfolio today. portfolio: optional id or partial name.',
    parameters: z.object({ portfolio: z.string().optional().default('') }),
    execute: async ({ portfolio }) => {
      const list = await sql`SELECT ticker, reason, since FROM pf_restricted ORDER BY ticker`
      const rows = await sql`
        SELECT p.name AS portfolio, h.ticker, h.name, h.market_value
        FROM pf_holdings h JOIN pf_portfolios p ON p.id = h.portfolio_id
        WHERE h.ticker IN (SELECT ticker FROM pf_restricted)
          AND (${portfolio} = '' OR p.id ILIKE ${portfolio} OR p.name ILIKE ${'%' + portfolio + '%'})`
      return JSON.stringify({ restricted_list: list, currently_held: rows })
    },
  }),

  ips_get_upcoming_dates: tool({
    description:
      'Upcoming covenant dates, client reporting deadlines and rebalancing windows, with owner. portfolio: optional id or partial name. days_ahead: look-ahead window (default 90).',
    parameters: z.object({ portfolio: z.string().optional().default(''), days_ahead: z.number().optional().default(90) }),
    execute: async ({ portfolio, days_ahead = 90 }) => {
      const rows = await sql`
        SELECT p.name AS portfolio, e.event_date, e.event_type, e.description, e.owner,
               (e.event_date - CURRENT_DATE) AS days_until
        FROM pf_events e JOIN pf_portfolios p ON p.id = e.portfolio_id
        WHERE e.event_date >= CURRENT_DATE AND e.event_date <= CURRENT_DATE + ${days_ahead}::int
          AND (${portfolio} = '' OR p.id ILIKE ${portfolio} OR p.name ILIKE ${'%' + portfolio + '%'})
        ORDER BY e.event_date`
      return JSON.stringify(rows)
    },
  }),
}
