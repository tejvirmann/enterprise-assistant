// Sample data, skills and wiring for the two industry demos:
//   findorff               -> a general contractor's project controls and safety (construction)
//   lancaster-investments  -> investment portfolio performance, risk and policy compliance
//
// Everything here is FICTIONAL sample data (invented projects, owners, securities and numbers).
// Shared by seed.ts (fresh databases) and migrate-industry-demos.ts (the live one).
//
//   stage()    creates the tables and sample data and adds the new tools/skills DISABLED. Inert for the
//              live site, so it is safe to run before the new code is deployed.
//   activate() switches the two companies over: removes the biologics tools/skills from Findorff, the
//              unrelated Rosetta tools from Lancaster, and enables the new ones.

import type { NeonQueryFunction } from '@neondatabase/serverless'

type Sql = NeonQueryFunction<false, false>

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export const FINDORFF_TOOLS = [
  'proj_list_projects', 'proj_get_project', 'proj_get_rfis', 'proj_get_submittals', 'proj_get_change_orders',
  'proj_get_milestones', 'proj_get_cost_summary', 'safety_get_incidents', 'safety_get_summary',
]
export const LANCASTER_TOOLS = [
  'port_list_portfolios', 'port_get_holdings', 'port_get_performance', 'port_get_attribution', 'port_get_liquidity',
  'risk_get_metrics', 'risk_get_concentration', 'ips_check_limits', 'ips_get_restricted_list', 'ips_get_upcoming_dates',
]

// ───────────────────────────── Findorff Demo: construction ─────────────────────────────

const FINDORFF_BASE_CONTEXT = `You are the project-controls assistant for a Madison-area general contractor (Findorff Demo). You help project managers, superintendents and executives understand where their projects stand: RFIs, submittals, change orders, schedule, cost and jobsite safety.

## How you work
- Query the tools before answering. Never invent project data, dates or dollar amounts; if a tool returns nothing, say so.
- All data in this demo is fictional sample data. Say so if asked where it comes from.
- Lead with what needs attention: overdue RFIs, late submittals, slipping milestones, pending change-order exposure, open safety items.
- Show amounts in dollars, dates as YYYY-MM-DD, and always name the project.
- Connect the dots: a late long-lead submittal or an overdue structural RFI is usually the driver behind a slipping milestone.

## What you do not do
- You do not give legal advice on contract claims, or make safety determinations that replace the safety manager's judgment.`

const FINDORFF_PROJECT_CONTROLS = `When asked about project status, health, RFIs, submittals, change orders, schedule or cost:

1. Status or "how is project X doing": call proj_get_project, then drill into whichever counts are non-zero.
2. RFIs: call proj_get_rfis (overdue_only for problems). Rank by days overdue, say who has the ball, and flag any with cost or schedule impact.
3. Submittals: call proj_get_submittals with late_only. Weigh lead_time_weeks: a late submittal with a long lead time threatens procurement even if the install date is far off.
4. Change orders: call proj_get_change_orders. Report pending exposure as a dollar total, grouped by reason (owner change, unforeseen condition, design error).
5. Schedule: call proj_get_milestones with slipping_only and quote the driver for each slip.
6. Cost: call proj_get_cost_summary and highlight cost codes with a positive projected variance (forecast over budget).

Present results as tables: Item | Project | Status | Days | Owner | Impact.`

const FINDORFF_SAFETY = `When asked about safety, incidents, near misses or corrective actions:

1. Weekly or portfolio view: call safety_get_summary. Lead with recordables, then first-aid cases, then near misses.
2. Detail: call safety_get_incidents (open_only for unresolved items). Group by trade and look for repeat patterns.
3. Every open corrective action needs an owner and a date; call out any that have been open more than 14 days.
4. Treat near misses at height, near cranes, or involving struck-by hazards as leading indicators worth escalating.

Do not make regulatory or fault determinations; recommend the safety manager review.`

const FINDORFF_OAC_BLUEPRINT = `Blueprint: Weekly OAC (Owner-Architect-Contractor) meeting prep for one project.

1. proj_get_project for the headline numbers.
2. proj_get_rfis (status Open): list each with days open and who has the ball; mark those that are overdue.
3. proj_get_submittals (late_only): list late items with lead time.
4. proj_get_change_orders (status Pending): list with amounts and total exposure.
5. proj_get_milestones (slipping_only): list slips with drivers.
6. safety_get_incidents (open_only) for the project.
7. Close with a one-paragraph summary and a short "decisions needed from the owner/architect this week" list.`

const FINDORFF_SCHEDULE_BLUEPRINT = `Blueprint: Schedule risk review across all projects.

1. proj_get_milestones (slipping_only) for every project; rank by slip days.
2. For each slipping milestone, find its likely drivers: proj_get_rfis (overdue_only) and proj_get_submittals (late_only) on the same project; match on the driver text and subject.
3. For each driver, state the action and who owns it (ball-in-court or subcontractor) and the date it must be resolved to recover the schedule.
4. Check proj_get_change_orders (Pending) for time-impacting items and note unresolved ones.
5. Finish with the three projects most at risk, and what to do first on each.`

const FINDORFF_MODULES = [
  { path: 'skills/project-controls.md', type: 'skill', name: 'Project Controls', description: 'RFIs, submittals, change orders, schedule milestones and cost across projects', tokens: 420, content: FINDORFF_PROJECT_CONTROLS },
  { path: 'skills/jobsite-safety.md', type: 'skill', name: 'Jobsite Safety', description: 'Incident and near-miss review, open corrective actions, trade patterns', tokens: 300, content: FINDORFF_SAFETY },
  { path: 'blueprints/weekly-oac-prep.md', type: 'blueprint', name: 'Weekly OAC Meeting Prep', description: 'Pull RFIs, submittals, change orders, schedule and safety into one meeting brief', tokens: 380, content: FINDORFF_OAC_BLUEPRINT },
  { path: 'blueprints/schedule-risk-review.md', type: 'blueprint', name: 'Schedule Risk Review', description: 'Tie slipping milestones to the late RFIs and submittals driving them', tokens: 360, content: FINDORFF_SCHEDULE_BLUEPRINT },
]

// ───────────────────────────── Lancaster: investments ─────────────────────────────

const LANCASTER_BASE_CONTEXT = `You are the Lancaster Portfolio Intelligence Assistant, an AI analyst for portfolio monitoring, risk management and investment-policy compliance.

## Data
You can query two sample portfolios: Lancaster Growth Fund and Lancaster Income & Preservation. All holdings, returns and risk figures are fictional sample data. Always call the tools; never invent figures. If a tool returns nothing, say so.

## How you work
- Present figures with units and comparison benchmarks. Show absolute return AND return vs benchmark.
- Be precise about time horizons: MTD, QTD, YTD, 1Y, 3Y.
- For compliance, report every breach with severity (Hard or Soft), the current value, the limit and what action is required.

## What you do not do
- You do not provide investment advice or buy/sell recommendations to external parties.
- You do not guarantee forward-looking projections.`

const LANCASTER_PERFORMANCE = `When asked about portfolio performance or returns:

1. port_list_portfolios if the portfolio is not specified (or cover both).
2. port_get_performance for return vs benchmark across MTD, QTD, YTD, 1Y and 3Y, with excess return.
3. port_get_attribution (group_by position, sector, asset_class) for top contributors and detractors, in basis points.
4. port_get_holdings to show current weights and flag any position over 5% of the portfolio.

Table format: Position | Weight | YTD Return | Contribution (bps)`

const LANCASTER_RISK = `When asked about risk, drawdown, volatility or concentration:

1. risk_get_metrics for volatility vs benchmark, VaR, beta, max drawdown, tracking error and Sharpe.
2. risk_get_concentration for the top positions, sector and asset-class weights and effective number of positions.
3. port_get_liquidity for how much can be sold within 1, 5 and 30 days.

Risk thresholds: flag if 1-day 95% VaR exceeds 1.5% of NAV. Flag any sector above 25% of the portfolio. Explain what is driving each flag.`

const LANCASTER_COMPLIANCE = `When asked about compliance, limits or investment policy (blueprint):

1. ips_check_limits for every Investment Policy Statement limit; report each Breach and Warning.
2. ips_get_restricted_list and report any restricted security that is currently held.
3. port_get_liquidity against the liquidity limits.
4. ips_get_upcoming_dates for covenant tests, client reporting deadlines and rebalancing windows.

Always finish with an "Action Required" table: Breach | Severity | Current vs Limit | Deadline | Owner. Distinguish soft limits (review) from hard limits (must fix).`

const LANCASTER_MODULES = [
  { path: 'skills/portfolio-performance.md', type: 'skill', name: 'Portfolio Performance', description: 'Return vs benchmark, attribution, contributors and detractors', tokens: 400, content: LANCASTER_PERFORMANCE },
  { path: 'skills/risk-volatility.md', type: 'skill', name: 'Risk & Volatility', description: 'VaR, drawdown, beta, concentration and liquidity', tokens: 400, content: LANCASTER_RISK },
  { path: 'blueprints/compliance-review.md', type: 'blueprint', name: 'Compliance Review', description: 'IPS limit checks, restricted list, liquidity and upcoming dates', tokens: 420, content: LANCASTER_COMPLIANCE },
]

// ───────────────────────────── DDL ─────────────────────────────

async function createTables(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS con_projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, project_type TEXT, owner TEXT, project_manager TEXT, superintendent TEXT,
    contract_value NUMERIC, percent_complete INT, status TEXT, start_date DATE, substantial_completion DATE)`
  await sql`CREATE TABLE IF NOT EXISTS con_rfis (
    id SERIAL PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), number TEXT, subject TEXT, discipline TEXT, status TEXT,
    ball_in_court TEXT, submitted_date DATE, due_date DATE, cost_impact BOOLEAN, schedule_impact BOOLEAN)`
  await sql`CREATE TABLE IF NOT EXISTS con_submittals (
    id TEXT PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), spec_section TEXT, description TEXT, subcontractor TEXT,
    status TEXT, submitted_date DATE, required_by DATE, lead_time_weeks INT)`
  await sql`CREATE TABLE IF NOT EXISTS con_change_orders (
    id SERIAL PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), co_number TEXT, description TEXT, reason TEXT,
    amount NUMERIC, status TEXT, submitted_date DATE)`
  await sql`CREATE TABLE IF NOT EXISTS con_milestones (
    id SERIAL PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), name TEXT, planned_date DATE, forecast_date DATE,
    status TEXT, driver TEXT)`
  await sql`CREATE TABLE IF NOT EXISTS con_budget (
    id SERIAL PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), cost_code TEXT, description TEXT,
    budget NUMERIC, committed NUMERIC, actual_to_date NUMERIC, forecast_final NUMERIC)`
  await sql`CREATE TABLE IF NOT EXISTS con_safety (
    id SERIAL PRIMARY KEY, project_id TEXT REFERENCES con_projects(id), event_date DATE, event_type TEXT, trade TEXT,
    description TEXT, corrective_action TEXT, status TEXT)`

  await sql`CREATE TABLE IF NOT EXISTS pf_portfolios (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, strategy TEXT, benchmark TEXT, inception_date DATE)`
  await sql`CREATE TABLE IF NOT EXISTS pf_holdings (
    id SERIAL PRIMARY KEY, portfolio_id TEXT REFERENCES pf_portfolios(id), ticker TEXT, name TEXT, asset_class TEXT, sector TEXT,
    shares NUMERIC, price NUMERIC, cost_basis_per_share NUMERIC, market_value NUMERIC, liquidity_days INT,
    ytd_return_pct NUMERIC, mtd_return_pct NUMERIC, start_weight_pct NUMERIC, beta NUMERIC)`
  await sql`CREATE TABLE IF NOT EXISTS pf_performance (
    portfolio_id TEXT REFERENCES pf_portfolios(id), period TEXT, return_pct NUMERIC, benchmark_return_pct NUMERIC,
    PRIMARY KEY (portfolio_id, period))`
  await sql`CREATE TABLE IF NOT EXISTS pf_risk (
    portfolio_id TEXT PRIMARY KEY REFERENCES pf_portfolios(id), as_of DATE, volatility_pct NUMERIC, benchmark_volatility_pct NUMERIC,
    var_95_1d_pct NUMERIC, var_99_1d_pct NUMERIC, var_95_10d_pct NUMERIC, beta NUMERIC, max_drawdown_pct NUMERIC,
    drawdown_peak DATE, drawdown_trough DATE, drawdown_status TEXT, tracking_error_pct NUMERIC, sharpe NUMERIC)`
  await sql`CREATE TABLE IF NOT EXISTS pf_ips_limits (
    id SERIAL PRIMARY KEY, portfolio_id TEXT REFERENCES pf_portfolios(id), name TEXT, scope TEXT, scope_value TEXT,
    limit_type TEXT, limit_value NUMERIC, severity TEXT)`
  await sql`CREATE TABLE IF NOT EXISTS pf_restricted (ticker TEXT PRIMARY KEY, reason TEXT, since DATE)`
  await sql`CREATE TABLE IF NOT EXISTS pf_events (
    id SERIAL PRIMARY KEY, portfolio_id TEXT REFERENCES pf_portfolios(id), event_date DATE, event_type TEXT, description TEXT, owner TEXT)`
}

// ───────────────────────────── Sample data ─────────────────────────────

async function loadConstructionData(sql: Sql) {
  await sql`TRUNCATE con_safety, con_budget, con_milestones, con_change_orders, con_submittals, con_rfis, con_projects RESTART IDENTITY CASCADE`

  const projects = [
    { id: 'lakeview-mob', name: 'Lakeview Medical Office Building', project_type: 'Healthcare', owner: 'Lakeview Health Partners', project_manager: 'Dana Reyes', superintendent: 'Tom Becker', contract_value: 48500000, percent_complete: 62, status: 'Active', start_date: iso(-300), substantial_completion: iso(150) },
    { id: 'eastside-garage', name: 'Eastside Parking Structure', project_type: 'Parking', owner: 'City of Fairhaven', project_manager: 'Marcus Webb', superintendent: 'Linda Ortiz', contract_value: 22300000, percent_complete: 48, status: 'Active', start_date: iso(-210), substantial_completion: iso(120) },
    { id: 'riverbend-2', name: 'Riverbend Apartments Phase 2', project_type: 'Multifamily', owner: 'Riverbend Living LLC', project_manager: 'Priya Natarajan', superintendent: 'Jake Holloway', contract_value: 36800000, percent_complete: 84, status: 'Active', start_date: iso(-400), substantial_completion: iso(45) },
    { id: 'northgate-fitout', name: 'Northgate Tech Campus Fit-Out', project_type: 'Commercial interiors', owner: 'Northgate Partners', project_manager: 'Sam Kowalski', superintendent: 'Erin Daly', contract_value: 14200000, percent_complete: 18, status: 'Active', start_date: iso(-60), substantial_completion: iso(200) },
    { id: 'millbrook-library', name: 'Millbrook Public Library Renovation', project_type: 'Civic', owner: 'Millbrook Public Library Board', project_manager: 'Dana Reyes', superintendent: 'Hector Alvarez', contract_value: 9700000, percent_complete: 97, status: 'Closeout', start_date: iso(-500), substantial_completion: iso(10) },
  ]
  await sql`INSERT INTO con_projects SELECT * FROM jsonb_populate_recordset(NULL::con_projects, ${JSON.stringify(projects)}::jsonb)`

  // number, subject, discipline, status, ball_in_court, submitted ago, due (days from today), cost, schedule
  type R = [string, string, string, string, string, number, number, boolean, boolean]
  const rfis: Record<string, R[]> = {
    'lakeview-mob': [
      ['RFI-112', 'Structural steel connection at gridline D-7 conflicts with MEP duct main', 'Structural', 'Open', 'Architect', 21, -7, true, true],
      ['RFI-118', 'Radiation shielding at Imaging Suite wall type W4', 'Architectural', 'Open', 'Architect', 9, 3, true, false],
      ['RFI-121', 'Medical gas outlet locations in Procedure Room 204', 'MEP', 'Answered', 'Contractor', 14, -2, false, false],
      ['RFI-124', 'Roof drain sizing at Level 3 mechanical penthouse', 'MEP', 'Open', 'Engineer', 12, -3, true, false],
      ['RFI-109', 'Door hardware schedule discrepancy, Level 1', 'Architectural', 'Closed', 'Contractor', 40, -25, false, false],
      ['RFI-127', 'Elevator pit waterproofing detail', 'Architectural', 'Open', 'Architect', 4, 6, false, true],
    ],
    'eastside-garage': [
      ['RFI-031', 'Post-tensioning tendon profile at ramp transition', 'Structural', 'Open', 'Engineer', 26, -12, true, true],
      ['RFI-033', 'Expansion joint detail at Level 3', 'Structural', 'Open', 'Engineer', 8, 2, false, false],
      ['RFI-028', 'Stair 1 landing dimension', 'Architectural', 'Closed', 'Contractor', 50, -30, false, false],
      ['RFI-035', 'Stair 2 handrail anchorage', 'Structural', 'Answered', 'Contractor', 10, -1, false, false],
      ['RFI-036', 'Drainage slope at Level 2 NE bay', 'Civil', 'Open', 'Engineer', 11, -1, true, false],
    ],
    'riverbend-2': [
      ['RFI-088', 'Unit 3B fire-rated assembly at demising wall', 'Architectural', 'Open', 'Architect', 15, -5, false, true],
      ['RFI-090', 'Corridor lighting control zones', 'MEP', 'Closed', 'Contractor', 45, -30, false, false],
      ['RFI-091', 'Stair pressurization fan location', 'MEP', 'Closed', 'Contractor', 38, -20, false, false],
      ['RFI-092', 'Exterior sealant color selection', 'Architectural', 'Answered', 'Contractor', 9, -2, false, false],
      ['RFI-094', 'Balcony railing anchor spacing', 'Structural', 'Open', 'Engineer', 5, 4, false, false],
    ],
    'northgate-fitout': [
      ['RFI-012', 'Demising wall extent at Suite 220', 'Architectural', 'Closed', 'Contractor', 30, -20, false, false],
      ['RFI-014', 'Ceiling height at collaboration area conflicts with sprinkler main', 'MEP', 'Open', 'Architect', 6, 1, false, true],
      ['RFI-015', 'Power feed for server-room cooling units', 'MEP', 'Open', 'Engineer', 13, -2, true, true],
      ['RFI-016', 'Acoustic ceiling tile selection', 'Architectural', 'Answered', 'Contractor', 7, -1, false, false],
    ],
    'millbrook-library': [
      ['RFI-044', 'Historic plaster patching method', 'Architectural', 'Closed', 'Contractor', 200, -180, true, false],
      ['RFI-046', 'Reading-room millwork finish', 'Architectural', 'Closed', 'Contractor', 90, -70, false, false],
      ['RFI-047', 'Accessible ramp handrail return', 'Architectural', 'Answered', 'Contractor', 8, -2, false, false],
    ],
  }
  const rfiRows = Object.entries(rfis).flatMap(([pid, list]) => list.map((r) => ({
    project_id: pid, number: r[0], subject: r[1], discipline: r[2], status: r[3], ball_in_court: r[4],
    submitted_date: iso(-r[5]), due_date: iso(r[6]), cost_impact: r[7], schedule_impact: r[8],
  })))
  await sql`INSERT INTO con_rfis (project_id, number, subject, discipline, status, ball_in_court, submitted_date, due_date, cost_impact, schedule_impact)
            SELECT project_id, number, subject, discipline, status, ball_in_court, submitted_date, due_date, cost_impact, schedule_impact
            FROM jsonb_to_recordset(${JSON.stringify(rfiRows)}::jsonb) AS t(project_id text, number text, subject text, discipline text, status text, ball_in_court text, submitted_date date, due_date date, cost_impact boolean, schedule_impact boolean)`

  // id, spec, description, sub, status, submitted ago (null = not submitted), required_by (days from today), lead weeks
  type S = [string, string, string, string, string, number | null, number, number]
  const subs: Record<string, S[]> = {
    'lakeview-mob': [
      ['S-0521', '05 12 00', 'Structural steel shop drawings, Level 4 roof', 'Midwest Steel Fabricators', 'Revise & Resubmit', 25, -10, 14],
      ['S-0533', '23 74 13', 'Rooftop air handling units', 'Badger Mechanical', 'Pending Review', 18, -3, 26],
      ['S-0540', '26 24 16', 'Switchgear and panelboards', 'Capitol Electric', 'Not Submitted', null, 5, 30],
      ['S-0512', '08 44 13', 'Curtain wall system', 'Glassworks Inc', 'Approved', 60, -30, 16],
      ['S-0545', '14 21 00', 'Traction elevators', 'Vertex Vertical', 'Pending Review', 9, 10, 28],
    ],
    'eastside-garage': [
      ['S-0211', '03 21 00', 'Post-tension strand and anchorage', 'Prairie Post-Tension', 'Revise & Resubmit', 30, -14, 10],
      ['S-0218', '03 30 00', 'Concrete mix designs, Levels 3-4', 'Cornerstone Concrete', 'Approved', 40, -20, 3],
      ['S-0225', '11 15 00', 'Parking access and revenue control equipment', 'Gatewise Systems', 'Not Submitted', null, -6, 20],
      ['S-0229', '26 56 00', 'LED garage luminaires', 'Capitol Electric', 'Pending Review', 5, 12, 12],
    ],
    'riverbend-2': [
      ['S-0310', '09 68 00', 'Carpet and resilient flooring', 'Interior Surfaces Co', 'Approved', 70, -45, 8],
      ['S-0318', '12 36 00', 'Quartz countertops', 'Stonehaven Fabrication', 'Pending Review', 12, -2, 8],
      ['S-0322', '10 28 00', 'Toilet accessories', 'Interior Surfaces Co', 'Approved', 35, -15, 4],
    ],
    'northgate-fitout': [
      ['S-0105', '26 05 00', 'Electrical rough-in package', 'Capitol Electric', 'Approved', 40, -25, 6],
      ['S-0112', '23 81 00', 'Computer-room air conditioning units', 'Badger Mechanical', 'Not Submitted', null, 20, 20],
      ['S-0114', '09 51 00', 'Acoustic ceilings', 'Interior Surfaces Co', 'Pending Review', 6, 8, 6],
    ],
    'millbrook-library': [
      ['S-0066', '12 24 00', 'Window shades', 'Interior Surfaces Co', 'Approved', 120, -90, 6],
      ['S-0069', '06 40 00', 'Reading-room millwork', 'Heritage Woodworks', 'Approved', 150, -110, 12],
    ],
  }
  const subRows = Object.entries(subs).flatMap(([pid, list]) => list.map((s) => ({
    id: s[0], project_id: pid, spec_section: s[1], description: s[2], subcontractor: s[3], status: s[4],
    submitted_date: s[5] === null ? null : iso(-s[5]), required_by: iso(s[6]), lead_time_weeks: s[7],
  })))
  await sql`INSERT INTO con_submittals SELECT * FROM jsonb_populate_recordset(NULL::con_submittals, ${JSON.stringify(subRows)}::jsonb)`

  // co, description, reason, amount, status, submitted ago
  type C = [string, string, string, number, string, number]
  const cos: Record<string, C[]> = {
    'lakeview-mob': [
      ['CO-014', 'Added radiation shielding at Imaging Suite', 'Owner change', 186400, 'Pending', 12],
      ['CO-015', 'Rock excavation at elevator pit', 'Unforeseen condition', 94750, 'Approved', 70],
      ['CO-017', 'Revised steel connection at D-7 (RFI-112)', 'Design error', 142300, 'Pending', 20],
      ['CO-011', 'Additional fire dampers per code official', 'Code requirement', 38900, 'Approved', 120],
    ],
    'eastside-garage': [
      ['CO-006', 'Post-tension redesign at ramp transition', 'Design error', 215000, 'Pending', 15],
      ['CO-005', 'Utility relocation at north entrance', 'Unforeseen condition', 61200, 'Approved', 90],
      ['CO-007', 'Owner-requested EV charging conduit', 'Owner change', 73500, 'Pending', 8],
    ],
    'riverbend-2': [
      ['CO-021', 'Lobby finish upgrade', 'Owner change', 48900, 'Approved', 40],
      ['CO-023', 'Fire-rated assembly revision at Unit 3B', 'Design clarification', 22300, 'Pending', 6],
      ['CO-019', 'Extended general conditions for weather delay', 'Contractor request', 31000, 'Rejected', 80],
    ],
    'northgate-fitout': [
      ['CO-002', 'After-hours MEP shift for tenant move-in', 'Owner change', 57800, 'Pending', 10],
      ['CO-001', 'Demolition of undocumented partition', 'Unforeseen condition', 12400, 'Approved', 35],
    ],
    'millbrook-library': [
      ['CO-009', 'Historic plaster repair', 'Unforeseen condition', 28600, 'Approved', 150],
    ],
  }
  const coRows = Object.entries(cos).flatMap(([pid, list]) => list.map((c) => ({
    project_id: pid, co_number: c[0], description: c[1], reason: c[2], amount: c[3], status: c[4], submitted_date: iso(-c[5]),
  })))
  await sql`INSERT INTO con_change_orders (project_id, co_number, description, reason, amount, status, submitted_date)
            SELECT project_id, co_number, description, reason, amount, status, submitted_date
            FROM jsonb_to_recordset(${JSON.stringify(coRows)}::jsonb) AS t(project_id text, co_number text, description text, reason text, amount numeric, status text, submitted_date date)`

  // name, planned (days from today), forecast, status, driver
  type M = [string, number, number, string, string]
  const ms: Record<string, M[]> = {
    'lakeview-mob': [
      ['Foundations complete', -150, -150, 'Complete', ''],
      ['Structural steel complete', -20, 8, 'In Progress', 'Late steel shop-drawing approval (S-0521) and overdue RFI-112 at D-7'],
      ['Building dried-in', 25, 45, 'In Progress', 'Follows structural steel'],
      ['Rooftop air handling units set', 40, 62, 'Not Started', 'AHU submittal late (S-0533), 26-week lead time'],
      ['Substantial completion', 150, 165, 'Not Started', 'Cumulative slip from steel and rooftop equipment'],
    ],
    'eastside-garage': [
      ['Level 2 deck pour', -60, -60, 'Complete', ''],
      ['Level 3 deck pour', -5, 15, 'In Progress', 'PT strand submittal revise & resubmit (S-0211); overdue RFI-031 on tendon profile'],
      ['Level 4 deck pour', 25, 45, 'Not Started', 'Follows Level 3'],
      ['Topping out', 50, 65, 'Not Started', 'Follows deck pours'],
      ['Substantial completion', 120, 120, 'Not Started', ''],
    ],
    'riverbend-2': [
      ['Leasing office ready', -20, -20, 'Complete', ''],
      ['Unit 3B inspection', 7, 12, 'In Progress', 'Overdue RFI-088 on fire-rated assembly'],
      ['Building B unit turnover', 14, 14, 'In Progress', ''],
      ['Final inspections', 35, 35, 'Not Started', ''],
      ['Substantial completion', 45, 45, 'Not Started', ''],
    ],
    'northgate-fitout': [
      ['Demolition complete', -25, -25, 'Complete', ''],
      ['MEP rough-in complete', 30, 30, 'In Progress', ''],
      ['Server room ready', 90, 100, 'Not Started', 'Cooling units not yet submitted (S-0112), 20-week lead time; RFI-015 power feed overdue'],
      ['Substantial completion', 200, 200, 'Not Started', ''],
    ],
    'millbrook-library': [
      ['Punch list complete', -10, 7, 'In Progress', 'Reading-room millwork touch-ups'],
      ['Final inspection', 5, 14, 'Not Started', 'Follows punch list'],
      ['Substantial completion', 10, 17, 'Not Started', 'Follows final inspection'],
    ],
  }
  const msRows = Object.entries(ms).flatMap(([pid, list]) => list.map((m) => ({
    project_id: pid, name: m[0], planned_date: iso(m[1]), forecast_date: iso(m[2]), status: m[3], driver: m[4],
  })))
  await sql`INSERT INTO con_milestones (project_id, name, planned_date, forecast_date, status, driver)
            SELECT project_id, name, planned_date, forecast_date, status, driver
            FROM jsonb_to_recordset(${JSON.stringify(msRows)}::jsonb) AS t(project_id text, name text, planned_date date, forecast_date date, status text, driver text)`

  // code, description, budget, committed, actual, forecast
  type B = [string, string, number, number, number, number]
  const budget: Record<string, B[]> = {
    'lakeview-mob': [
      ['01', 'General conditions', 4100000, 3600000, 2500000, 4350000],
      ['03', 'Concrete', 5600000, 5600000, 5400000, 5640000],
      ['05', 'Structural steel', 6200000, 6200000, 3900000, 6520000],
      ['08', 'Openings and glazing', 3900000, 3750000, 1200000, 3900000],
      ['09', 'Finishes', 4300000, 1900000, 600000, 4300000],
      ['23', 'HVAC', 8200000, 8050000, 3300000, 8450000],
      ['26', 'Electrical', 6100000, 5300000, 2500000, 6100000],
    ],
    'eastside-garage': [
      ['01', 'General conditions', 2300000, 2000000, 1100000, 2420000],
      ['03', 'Concrete and post-tensioning', 9800000, 9800000, 5000000, 10250000],
      ['05', 'Metals', 1900000, 1700000, 700000, 1900000],
      ['07', 'Waterproofing and sealants', 1400000, 900000, 200000, 1400000],
      ['26', 'Electrical and lighting', 2600000, 1800000, 600000, 2680000],
      ['31', 'Earthwork and utilities', 1800000, 1800000, 1750000, 1860000],
    ],
    'riverbend-2': [
      ['01', 'General conditions', 3300000, 3200000, 2900000, 3380000],
      ['03', 'Concrete', 4200000, 4200000, 4200000, 4200000],
      ['06', 'Rough carpentry', 5100000, 5100000, 4700000, 5160000],
      ['09', 'Finishes', 4800000, 4500000, 3400000, 4880000],
      ['22', 'Plumbing', 3900000, 3900000, 3300000, 3900000],
      ['23', 'HVAC', 3700000, 3700000, 3100000, 3760000],
    ],
    'northgate-fitout': [
      ['01', 'General conditions', 1200000, 900000, 260000, 1200000],
      ['09', 'Finishes and ceilings', 3100000, 1100000, 150000, 3100000],
      ['23', 'HVAC', 3400000, 2600000, 500000, 3520000],
      ['26', 'Electrical', 3000000, 2800000, 700000, 3000000],
      ['27', 'Low voltage and data', 1200000, 800000, 90000, 1200000],
    ],
    'millbrook-library': [
      ['01', 'General conditions', 1100000, 1100000, 1080000, 1110000],
      ['06', 'Millwork', 1600000, 1600000, 1520000, 1640000],
      ['09', 'Finishes', 1900000, 1900000, 1860000, 1900000],
      ['23', 'HVAC', 1800000, 1800000, 1790000, 1800000],
      ['26', 'Electrical', 1500000, 1500000, 1470000, 1500000],
    ],
  }
  const budgetRows = Object.entries(budget).flatMap(([pid, list]) => list.map((b) => ({
    project_id: pid, cost_code: b[0], description: b[1], budget: b[2], committed: b[3], actual_to_date: b[4], forecast_final: b[5],
  })))
  await sql`INSERT INTO con_budget (project_id, cost_code, description, budget, committed, actual_to_date, forecast_final)
            SELECT project_id, cost_code, description, budget, committed, actual_to_date, forecast_final
            FROM jsonb_to_recordset(${JSON.stringify(budgetRows)}::jsonb) AS t(project_id text, cost_code text, description text, budget numeric, committed numeric, actual_to_date numeric, forecast_final numeric)`

  // days ago, type, trade, description, corrective action, status
  type F = [number, string, string, string, string, string]
  const safety: Record<string, F[]> = {
    'lakeview-mob': [
      [3, 'Near miss', 'Ironworkers', 'Unsecured decking plate shifted near the edge at Level 4', 'Re-secure all plates and run a toolbox talk on decking', 'Open'],
      [9, 'First aid', 'Laborers', 'Hand laceration from a sheet-metal edge', 'Cut-resistant gloves required for sheet-metal handling', 'Closed'],
      [15, 'Observation', 'Electricians', 'Missing GFCI on temporary power', 'GFCI installed and temporary power audited', 'Closed'],
      [21, 'Recordable', 'Ironworkers', 'Ankle sprain stepping off a ladder, restricted duty', 'Ladder inspection and retraining', 'Open'],
    ],
    'eastside-garage': [
      [2, 'Near miss', 'Concrete', 'Concrete pump hose whip during deck pour', 'Add hose restraints before next pour', 'Open'],
      [6, 'Observation', 'Concrete', 'Guardrail gap at stair opening, Level 2', 'Repaired same day', 'Closed'],
      [11, 'First aid', 'Carpenters', 'Eye irritation from airborne debris', 'Enforce safety glasses at the formwork', 'Closed'],
      [18, 'Near miss', 'Laborers', 'Struck-by exposure during a crane pick', 'Revise the lift plan and exclusion zone', 'Open'],
    ],
    'riverbend-2': [
      [5, 'Observation', 'Painters', 'Ladder set on an uneven surface', 'Leveling feet provided', 'Closed'],
      [20, 'First aid', 'Roofers', 'Heat exhaustion on a hot afternoon', 'Add shaded rest breaks and water stations', 'Closed'],
    ],
    'northgate-fitout': [
      [4, 'Observation', 'Electricians', 'Lockout/tagout tag missing on a panel', 'Retrain crew on LOTO procedure', 'Open'],
    ],
    'millbrook-library': [
      [30, 'Observation', 'Painters', 'Solvent container left unlabeled', 'Labeling reminder issued', 'Closed'],
    ],
  }
  const safetyRows = Object.entries(safety).flatMap(([pid, list]) => list.map((f) => ({
    project_id: pid, event_date: iso(-f[0]), event_type: f[1], trade: f[2], description: f[3], corrective_action: f[4], status: f[5],
  })))
  await sql`INSERT INTO con_safety (project_id, event_date, event_type, trade, description, corrective_action, status)
            SELECT project_id, event_date, event_type, trade, description, corrective_action, status
            FROM jsonb_to_recordset(${JSON.stringify(safetyRows)}::jsonb) AS t(project_id text, event_date date, event_type text, trade text, description text, corrective_action text, status text)`
}

async function loadPortfolioData(sql: Sql) {
  await sql`TRUNCATE pf_events, pf_restricted, pf_ips_limits, pf_risk, pf_performance, pf_holdings, pf_portfolios RESTART IDENTITY CASCADE`

  await sql`INSERT INTO pf_portfolios VALUES
    ('growth', 'Lancaster Growth Fund', 'Global growth equity with a fixed-income and private-credit sleeve', 'MSCI ACWI', ${iso(-1800)}),
    ('income', 'Lancaster Income & Preservation', 'Income-oriented, capital preservation: bonds with a dividend-equity sleeve', '40% MSCI ACWI / 60% Bloomberg US Aggregate', ${iso(-2400)})`

  // ticker, name, asset class, sector, market value ($M), days to liquidate, YTD %, MTD %, starting weight %, beta
  type H = [string, string, string, string, number, number, number, number, number, number]
  const growth: H[] = [
    ['NWSY', 'Northwind Systems', 'Equity', 'Technology', 7.4, 1, 34.2, 2.1, 5.0, 1.25],
    ['ARCL', 'Arclight Semiconductor', 'Equity', 'Technology', 5.6, 1, 41.0, 3.4, 3.6, 1.55],
    ['CLDV', 'Cloudvane Software', 'Equity', 'Technology', 4.9, 1, 22.5, -1.2, 3.9, 1.3],
    ['QNTX', 'Quantix Data', 'Equity', 'Technology', 4.2, 2, 12.4, 0.5, 3.8, 1.2],
    ['SYNP', 'Synapse Networks', 'Equity', 'Technology', 4.4, 1, 15.8, 1.1, 3.4, 1.1],
    ['DTLK', 'Datalake Analytics', 'Equity', 'Technology', 3.8, 1, 9.6, 0.3, 3.2, 1.2],
    ['HLTH', 'Helix Therapeutics', 'Equity', 'Healthcare', 5.0, 1, 8.1, -0.8, 4.4, 0.9],
    ['MDVX', 'Medivex Devices', 'Equity', 'Healthcare', 4.0, 1, 3.2, 0.2, 3.5, 0.85],
    ['GNVA', 'Genovia Biosciences', 'Equity', 'Healthcare', 3.6, 3, -6.5, -2.0, 3.2, 1.0],
    ['FINX', 'Finmark Bancorp', 'Equity', 'Financials', 4.6, 1, 14.0, 1.0, 4.1, 1.1],
    ['CPTL', 'Capital Ridge Insurance', 'Equity', 'Financials', 3.8, 1, 9.5, 0.4, 3.5, 0.95],
    ['PRRE', 'Prairie Energy Partners', 'Equity', 'Energy', 4.1, 1, -11.2, -3.1, 4.0, 1.15],
    ['EVRF', 'Everfield Consumer Brands', 'Equity', 'Consumer Staples', 3.9, 1, 2.1, 0.3, 3.6, 0.65],
    ['BRWY', 'Brightway Retail', 'Equity', 'Consumer Discretionary', 4.3, 1, -9.8, -1.5, 3.9, 1.25],
    ['FRGL', 'Forgeline Industrial', 'Equity', 'Industrials', 4.7, 1, 11.2, 0.9, 4.3, 1.05],
    ['SKYR', 'Skyreach Aerospace', 'Equity', 'Industrials', 3.9, 1, 19.6, 1.8, 3.4, 1.2],
    ['GRLK', 'Greenlake Utilities', 'Equity', 'Utilities', 3.2, 1, 4.0, 0.1, 3.0, 0.5],
    ['SMRT', 'Summit Realty Trust', 'Equity', 'Real Estate', 3.0, 3, -4.5, -0.9, 2.9, 0.9],
    ['STNB', 'Stonebridge Materials', 'Equity', 'Materials', 3.2, 1, 6.3, 0.4, 3.0, 1.0],
    ['LPCF', 'Lancaster Private Credit Fund', 'Alternatives', 'Private Credit', 10.5, 90, 7.2, 0.6, 9.5, 0.2],
    ['UST5', 'US Treasury 5-Year Ladder', 'Fixed Income', 'Government', 8.0, 1, 2.9, 0.2, 7.4, 0.05],
    ['IGCF', 'Investment-Grade Corporate Bond Fund', 'Fixed Income', 'Credit', 5.0, 2, 4.1, 0.3, 4.6, 0.2],
    ['MMKT', 'Money Market Fund', 'Cash', 'Cash', 3.5, 1, 3.8, 0.3, 3.4, 0.0],
  ]
  const income: H[] = [
    ['UST3', 'US Treasury 3-Year Ladder', 'Fixed Income', 'Government', 18.0, 1, 3.0, 0.2, 17.5, 0.05],
    ['UST10', 'US Treasury 10-Year', 'Fixed Income', 'Government', 12.0, 1, 1.8, 0.1, 12.0, 0.15],
    ['IGCF', 'Investment-Grade Corporate Bond Fund', 'Fixed Income', 'Credit', 16.0, 2, 5.1, 0.4, 15.5, 0.2],
    ['MUNI', 'Municipal Bond Ladder', 'Fixed Income', 'Municipal', 9.0, 5, 3.4, 0.2, 9.0, 0.1],
    ['HYBD', 'High-Yield Bond Fund', 'Fixed Income', 'Credit', 6.0, 3, 6.9, 0.5, 5.8, 0.45],
    ['DIVE', 'Dividend Equity Fund', 'Equity', 'Diversified', 14.0, 1, 9.7, 0.8, 13.5, 0.85],
    ['PRRE', 'Prairie Energy Partners', 'Equity', 'Energy', 4.0, 1, -11.2, -3.1, 4.2, 1.15],
    ['GRLK', 'Greenlake Utilities', 'Equity', 'Utilities', 5.0, 1, 4.0, 0.1, 5.1, 0.5],
    ['FINX', 'Finmark Bancorp', 'Equity', 'Financials', 4.0, 1, 14.0, 1.0, 3.9, 1.1],
    ['SMRT', 'Summit Realty Trust', 'Equity', 'Real Estate', 5.0, 3, -4.5, -0.9, 5.2, 0.9],
    ['MMKT', 'Money Market Fund', 'Cash', 'Cash', 6.0, 1, 3.8, 0.3, 6.0, 0.0],
  ]
  const holdRows = (pid: string, hs: H[]) => hs.map((h, i) => {
    const price = +(20 + ((i * 37) % 180) + (h[0].charCodeAt(0) % 10) / 10).toFixed(2)
    const cost = +(price / (1 + Math.max(-0.4, Math.min(1.2, h[6] / 100 + 0.05))) ).toFixed(2)
    return {
      portfolio_id: pid, ticker: h[0], name: h[1], asset_class: h[2], sector: h[3], shares: Math.round((h[4] * 1_000_000) / price),
      price, cost_basis_per_share: cost, market_value: h[4] * 1_000_000, liquidity_days: h[5], ytd_return_pct: h[6],
      mtd_return_pct: h[7], start_weight_pct: h[8], beta: h[9],
    }
  })
  const allHoldings = [...holdRows('growth', growth), ...holdRows('income', income)]
  await sql`INSERT INTO pf_holdings (portfolio_id, ticker, name, asset_class, sector, shares, price, cost_basis_per_share, market_value, liquidity_days, ytd_return_pct, mtd_return_pct, start_weight_pct, beta)
            SELECT portfolio_id, ticker, name, asset_class, sector, shares, price, cost_basis_per_share, market_value, liquidity_days, ytd_return_pct, mtd_return_pct, start_weight_pct, beta
            FROM jsonb_to_recordset(${JSON.stringify(allHoldings)}::jsonb) AS t(portfolio_id text, ticker text, name text, asset_class text, sector text, shares numeric, price numeric, cost_basis_per_share numeric, market_value numeric, liquidity_days int, ytd_return_pct numeric, mtd_return_pct numeric, start_weight_pct numeric, beta numeric)`

  // YTD is derived from the holdings (starting weight x return) so attribution and performance agree.
  const ytd = (hs: H[]) => +(hs.reduce((a, h) => a + (h[8] * h[6]) / 100, 0)).toFixed(1)
  const gY = ytd(growth), iY = ytd(income)
  const perf = [
    ['growth', 'MTD', 1.2, 0.9], ['growth', 'QTD', 3.1, 2.4], ['growth', 'YTD', gY, +(gY - 2.5).toFixed(1)], ['growth', '1Y', 11.6, 9.4], ['growth', '3Y', 9.4, 8.1],
    ['income', 'MTD', 0.4, 0.3], ['income', 'QTD', 1.1, 1.3], ['income', 'YTD', iY, +(iY + 0.6).toFixed(1)], ['income', '1Y', Math.round((iY + 1.1) * 10) / 10, Math.round((iY + 1.7) * 10) / 10], ['income', '3Y', 3.1, 3.5],
  ].map(([portfolio_id, period, return_pct, benchmark_return_pct]) => ({ portfolio_id, period, return_pct, benchmark_return_pct }))
  await sql`INSERT INTO pf_performance
            SELECT * FROM jsonb_populate_recordset(NULL::pf_performance, ${JSON.stringify(perf)}::jsonb)`

  await sql`INSERT INTO pf_risk VALUES
    ('growth', ${iso(0)}, 16.8, 15.2, 1.62, 2.29, 5.12, 1.12, -14.3, ${iso(-240)}, ${iso(-170)}, 'Recovered', 3.1, 1.04),
    ('income', ${iso(0)}, 5.1, 6.0, 0.52, 0.74, 1.64, 0.38, -4.1, ${iso(-300)}, ${iso(-260)}, 'Recovered', 1.8, 0.82)`

  await sql`INSERT INTO pf_ips_limits (portfolio_id, name, scope, scope_value, limit_type, limit_value, severity) VALUES
    ('growth', 'Single name (soft)', 'single_name', '*', 'max', 5, 'Soft'),
    ('growth', 'Single name (hard)', 'single_name', '*', 'max', 7, 'Hard'),
    ('growth', 'Sector concentration', 'sector', '*', 'max', 25, 'Soft'),
    ('growth', 'Equity allocation', 'asset_class', 'Equity', 'max', 85, 'Hard'),
    ('growth', 'Fixed income floor', 'asset_class', 'Fixed Income', 'min', 8, 'Soft'),
    ('growth', 'Liquidity within 30 days', 'liquidity', '30', 'min', 90, 'Soft'),
    ('growth', 'Liquidity within 5 days', 'liquidity', '5', 'min', 80, 'Hard'),
    ('income', 'Single name (soft)', 'single_name', '*', 'max', 15, 'Soft'),
    ('income', 'Sector concentration', 'sector', '*', 'max', 30, 'Soft'),
    ('income', 'Equity allocation', 'asset_class', 'Equity', 'max', 35, 'Hard'),
    ('income', 'Fixed income floor', 'asset_class', 'Fixed Income', 'min', 55, 'Soft'),
    ('income', 'Liquidity within 5 days', 'liquidity', '5', 'min', 85, 'Hard')`

  await sql`INSERT INTO pf_restricted VALUES
    ('QNTX', 'Pending acquisition; board-overlap conflict of interest', ${iso(-45)}),
    ('ZYRN', 'Issuer is a client of the firm', ${iso(-200)})`

  await sql`INSERT INTO pf_events (portfolio_id, event_date, event_type, description, owner) VALUES
    ('growth', ${iso(9)}, 'Rebalancing', 'Quarterly rebalancing window opens', 'Portfolio Manager'),
    ('growth', ${iso(14)}, 'Client reporting', 'Quarterly client report due', 'Client Service'),
    ('growth', ${iso(21)}, 'Covenant', 'Credit facility covenant test (NAV at or above $100M)', 'Operations'),
    ('growth', ${iso(30)}, 'Governance', 'Annual IPS review with the investment committee', 'CIO'),
    ('income', ${iso(12)}, 'Client reporting', 'Quarterly client report due', 'Client Service'),
    ('income', ${iso(45)}, 'Rebalancing', 'Quarterly rebalancing window opens', 'Portfolio Manager')`
}

// ───────────────────────────── Wiring ─────────────────────────────

async function addToolsDisabled(sql: Sql, companyId: string, toolIds: string[]) {
  for (const id of toolIds) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled)
              SELECT ${companyId}, ${id}, false
              WHERE NOT EXISTS (SELECT 1 FROM company_tools WHERE company_id = ${companyId} AND tool_id = ${id})`
  }
}

async function upsertModules(sql: Sql, personaId: string, modules: typeof FINDORFF_MODULES, enabled: boolean) {
  for (const m of modules) {
    const existing = await sql`SELECT id FROM persona_modules WHERE persona_id = ${personaId} AND name = ${m.name}`
    if (existing.length) {
      await sql`UPDATE persona_modules SET type = ${m.type}, description = ${m.description}, tokens = ${m.tokens}, content = ${m.content}, path = ${m.path}, enabled = ${enabled}
                WHERE persona_id = ${personaId} AND name = ${m.name}`
    } else {
      await sql`INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content)
                VALUES (${personaId}, 'local', ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${enabled}, ${m.content})`
    }
  }
}

async function upsertRepo(sql: Sql, id: string, name: string, description: string, modules: typeof FINDORFF_MODULES) {
  await sql`INSERT INTO repos (id, name, description, owner, scope, verified, module_count)
            VALUES (${id}, ${name}, ${description}, 'MadStack', 'private', true, ${modules.length})
            ON CONFLICT (id) DO UPDATE SET name = ${name}, description = ${description}, module_count = ${modules.length}`
  await sql`DELETE FROM repo_modules WHERE repo_id = ${id}`
  for (const m of modules) {
    await sql`INSERT INTO repo_modules (repo_id, path, type, name, description, tokens, content)
              VALUES (${id}, ${m.path}, ${m.type}, ${m.name}, ${m.description}, ${m.tokens}, ${m.content})`
  }
}

/** Create tables + sample data, and add the new tools and skills DISABLED. Safe before the new code is deployed. */
export async function stage(sql: Sql) {
  await createTables(sql)
  await loadConstructionData(sql)
  await loadPortfolioData(sql)
  await addToolsDisabled(sql, 'findorff', FINDORFF_TOOLS)
  await addToolsDisabled(sql, 'lancaster-investments', LANCASTER_TOOLS)
  await upsertModules(sql, 'findorff-default', FINDORFF_MODULES, false)
}

/** Switch Findorff Demo to construction and Lancaster to the portfolio toolset. */
export async function activate(sql: Sql) {
  // Findorff Demo
  const brand = JSON.stringify({ tagline: 'by MadStack', chat_welcome: 'Findorff Demo ready. Ask about RFIs, submittals, change orders, schedule, cost or jobsite safety.' })
  await sql`UPDATE companies SET description = 'General contractor project controls: RFIs, submittals, change orders, schedule, cost and jobsite safety',
            base_context = ${FINDORFF_BASE_CONTEXT}, brand_config = ${brand}::jsonb WHERE id = 'findorff'`
  await sql`UPDATE personas SET name = 'Project Engineer', description = 'Project engineer with project-controls and safety data' WHERE id = 'findorff-default'`
  await sql`DELETE FROM persona_modules WHERE persona_id = 'findorff-default' AND name <> ALL (${FINDORFF_MODULES.map((m) => m.name)})`
  await upsertModules(sql, 'findorff-default', FINDORFF_MODULES, true)
  await sql`DELETE FROM company_tools WHERE company_id = 'findorff' AND tool_id <> ALL (${FINDORFF_TOOLS})`
  await sql`UPDATE company_tools SET enabled = true WHERE company_id = 'findorff'`
  await upsertRepo(sql, 'findorff-projects', 'Findorff Project Controls & Safety', 'Project-controls and safety skills and review blueprints for a general contractor', FINDORFF_MODULES)
  await sql`DELETE FROM company_repos WHERE company_id = 'findorff'`
  await sql`INSERT INTO company_repos (company_id, repo_id) VALUES ('findorff', 'findorff-projects')`

  // Lancaster
  await sql`UPDATE companies SET base_context = ${LANCASTER_BASE_CONTEXT} WHERE id = 'lancaster-investments'`
  await sql`DELETE FROM persona_modules WHERE persona_id = 'lancaster-portfolio' AND name <> ALL (${LANCASTER_MODULES.map((m) => m.name)})`
  await upsertModules(sql, 'lancaster-portfolio', LANCASTER_MODULES, true)
  await addToolsDisabled(sql, 'lancaster-investments', LANCASTER_TOOLS)
  await sql`DELETE FROM company_tools WHERE company_id = 'lancaster-investments' AND tool_id <> ALL (${LANCASTER_TOOLS})`
  await sql`UPDATE company_tools SET enabled = true WHERE company_id = 'lancaster-investments'`
  await upsertRepo(sql, 'lancaster-portfolio', 'Lancaster Portfolio Intelligence', 'Performance, risk and compliance skills for an investment firm', LANCASTER_MODULES)
  await sql`DELETE FROM company_repos WHERE company_id = 'lancaster-investments'`
  await sql`INSERT INTO company_repos (company_id, repo_id) VALUES ('lancaster-investments', 'lancaster-portfolio')`
}
