// Seed script — port of lattice-poc/scripts/seed_databases.py
// Creates all tables and populates with the same demo biologics data.
// Run: npm run db:seed

import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysFromNow(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function rand(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

// Seeded random (reproducible like Python's random.seed(42))
let _seed = 42
function seededRand() {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff
  return ((_seed >>> 0) / 0x100000000)
}
function seededChoice<T>(arr: T[]): T {
  return arr[Math.floor(seededRand() * arr.length)]
}
function seededRandRange(min: number, max: number) {
  return min + seededRand() * (max - min)
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

async function createTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS lims_compounds (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, cas_number TEXT,
      molecular_weight REAL, formula TEXT, drug_class TEXT, target TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS lims_instruments (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, type TEXT, model TEXT,
      serial TEXT, calibration_due TEXT, status TEXT DEFAULT 'Operational'
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS lims_assays (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, method TEXT, unit TEXT,
      lod REAL, loq REAL, validated INTEGER DEFAULT 1
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS lims_samples (
      id SERIAL PRIMARY KEY, compound_id INTEGER REFERENCES lims_compounds(id),
      name TEXT NOT NULL, matrix TEXT, concentration_mg_ml REAL,
      storage_temp TEXT, analyst TEXT, created_at TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS lims_results (
      id SERIAL PRIMARY KEY, sample_id INTEGER REFERENCES lims_samples(id),
      assay_id INTEGER REFERENCES lims_assays(id),
      instrument_id INTEGER REFERENCES lims_instruments(id),
      value REAL, unit TEXT, pass_fail TEXT, analyst TEXT, run_date TEXT, notes TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_products (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, formulation_type TEXT,
      strength TEXT, route_of_admin TEXT, target_indication TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_specifications (
      id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES qms_products(id),
      parameter TEXT NOT NULL, min_value REAL, max_value REAL, unit TEXT, test_method TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_batches (
      id SERIAL PRIMARY KEY, product_id INTEGER REFERENCES qms_products(id),
      lot_number TEXT UNIQUE NOT NULL, manufacture_date TEXT, expiry_date TEXT,
      batch_size_kg REAL, status TEXT DEFAULT 'In Review'
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_deviations (
      id SERIAL PRIMARY KEY, batch_id INTEGER REFERENCES qms_batches(id),
      deviation_number TEXT UNIQUE NOT NULL, description TEXT, severity TEXT,
      root_cause TEXT, status TEXT DEFAULT 'Open', opened_date TEXT, closed_date TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_capas (
      id SERIAL PRIMARY KEY, deviation_id INTEGER REFERENCES qms_deviations(id),
      capa_number TEXT UNIQUE NOT NULL, action_description TEXT, owner TEXT,
      due_date TEXT, status TEXT DEFAULT 'Open', effectiveness_check TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS qms_audits (
      id SERIAL PRIMARY KEY, type TEXT, auditor TEXT, date TEXT, department TEXT,
      findings_count INTEGER, critical_count INTEGER, status TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS rosetta_term_map (
      id SERIAL PRIMARY KEY, source_system TEXT, source_term TEXT,
      canonical_term TEXT, ontology_code TEXT, confidence REAL
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS rosetta_unit_conversions (
      id SERIAL PRIMARY KEY, from_unit TEXT, to_unit TEXT, factor REAL, addend REAL
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS rosetta_compound_aliases (
      id SERIAL PRIMARY KEY, canonical_name TEXT, alias TEXT, source_system TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      logo_url TEXT, color TEXT DEFAULT '#369996',
      brand_config JSONB,
      base_context TEXT, default_persona_id TEXT,
      admin_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Migrations for existing installs
  await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_config JSONB`
  await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_key TEXT`
  await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`

  await sql`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id),
      name TEXT NOT NULL, description TEXT,
      scope TEXT DEFAULT 'private',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE personas ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'private'`

  await sql`
    CREATE TABLE IF NOT EXISTS persona_modules (
      id SERIAL PRIMARY KEY, persona_id TEXT REFERENCES personas(id) ON DELETE CASCADE,
      repo_id TEXT, path TEXT, type TEXT, name TEXT,
      description TEXT, tokens INTEGER, enabled BOOLEAN DEFAULT true, content TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS company_tools (
      id SERIAL PRIMARY KEY, company_id TEXT REFERENCES companies(id),
      tool_id TEXT, enabled BOOLEAN DEFAULT true
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      repo_url TEXT, branch TEXT DEFAULT 'main', owner TEXT,
      scope TEXT DEFAULT 'private', verified BOOLEAN DEFAULT false,
      module_count INTEGER DEFAULT 0, synced_at TIMESTAMPTZ
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS repo_modules (
      id SERIAL PRIMARY KEY, repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
      path TEXT NOT NULL, type TEXT, name TEXT, description TEXT,
      tokens INTEGER, content TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS company_repos (
      company_id TEXT REFERENCES companies(id),
      repo_id TEXT REFERENCES repos(id),
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (company_id, repo_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS company_mcp_servers (
      id SERIAL PRIMARY KEY,
      company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      transport TEXT DEFAULT 'http',
      enabled BOOLEAN DEFAULT true,
      tools JSONB DEFAULT '[]',
      last_scanned TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT REFERENCES companies(id),
      persona_id TEXT, modules JSONB, tools JSONB,
      system_prompt TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT, content TEXT, parts JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('  Tables created.')
}

// ---------------------------------------------------------------------------
// Clear existing data
// ---------------------------------------------------------------------------

async function clearData() {
  await sql`TRUNCATE chat_messages, sessions, company_repos, company_tools, repo_modules, repos,
    persona_modules, personas, companies,
    rosetta_compound_aliases, rosetta_unit_conversions, rosetta_term_map,
    qms_audits, qms_capas, qms_deviations, qms_batches, qms_specifications, qms_products,
    lims_results, lims_samples, lims_assays, lims_instruments, lims_compounds
    RESTART IDENTITY CASCADE`
  console.log('  Cleared existing data.')
}

// ---------------------------------------------------------------------------
// LIMS
// ---------------------------------------------------------------------------

async function seedLims() {
  await sql`
    INSERT INTO lims_compounds (name, cas_number, molecular_weight, formula, drug_class, target) VALUES
    ('XB-441',  'XB-441-MAB',   148200, 'IgG1 mAb',      'Monoclonal Antibody',     'PD-L1'),
    ('KL-872',  'KL-872-ADC',   152400, 'IgG1-DM1 ADC',  'Antibody-Drug Conjugate', 'HER2'),
    ('ZM-103',  '1029384-75-2',  438.5, 'C24H26N4O4S',   'Kinase Inhibitor',        'CDK4/6'),
    ('AB-290',  'AB-290-BSP',   195000, 'Bispecific IgG', 'Bispecific Antibody',     'CD3xCD19')
  `

  await sql`
    INSERT INTO lims_instruments (name, type, model, serial, calibration_due, status) VALUES
    ('HPLC-01', 'HPLC',             'Agilent 1290',          'AG1290-4471',  ${daysFromNow(87)},  'Operational'),
    ('SEC-01',  'SEC-HPLC',         'Waters Alliance e2695', 'WT-ALC-0023',  ${daysFromNow(52)},  'Operational'),
    ('BCA-01',  'Spectrophotometer','BioTek Epoch 2',        'BT-EP-0091',   ${daysFromNow(41)},  'Operational'),
    ('LAL-01',  'Endotoxin Reader', 'Charles River PTS',     'CR-PTS-007',   ${daysFromNow(130)}, 'Operational'),
    ('OSM-01',  'Osmometer',        'Wescor Vapro 5600',     'WV-5600-003',  ${daysFromNow(-5)},  'Calibration Due')
  `

  await sql`
    INSERT INTO lims_assays (name, method, unit, lod, loq, validated) VALUES
    ('HPLC Purity',           'RP-HPLC',           '%',            0.05, 0.1,  1),
    ('SEC Aggregate',         'SEC-HPLC',          '%',            0.1,  0.2,  1),
    ('Protein Concentration', 'BCA Assay',         'mg/mL',        0.05, 0.1,  1),
    ('Endotoxin',             'LAL Kinetic',       'EU/mL',        0.01, 0.05, 1),
    ('Bioassay Potency',      'Cell-Based Assay',  '% Ref',        5.0,  10.0, 1),
    ('Osmolality',            'Vapor Pressure Osm','mOsm/kg',      NULL, NULL, 1),
    ('pH',                    'Potentiometric',    'pH units',     NULL, NULL, 1),
    ('Sub-Visible Particles', 'MFI',               'particles/mL', NULL, NULL, 1)
  `

  const analysts = ['R. Patel', 'S. Kim', 'M. Okonkwo', 'A. Reyes', 'L. Chen']
  const matrices = ['Drug Substance', 'Drug Product', 'In-Process', 'Reference Standard']

  // Insert samples (4 compounds × 6 batches = 24 samples)
  for (let cid = 1; cid <= 4; cid++) {
    for (let batch = 1; batch <= 6; batch++) {
      const conc = parseFloat(seededRandRange(5, 25).toFixed(2))
      await sql`
        INSERT INTO lims_samples (compound_id, name, matrix, concentration_mg_ml, storage_temp, analyst, created_at)
        VALUES (
          ${cid},
          ${`LOT-${String(cid).padStart(2,'0')}${String(batch).padStart(3,'0')}`},
          ${seededChoice(matrices)},
          ${conc},
          ${cid === 3 ? '25°C' : '-20°C'},
          ${seededChoice(analysts)},
          ${daysAgo(Math.floor(seededRandRange(30, 365)))}
        )
      `
    }
  }

  // Insert results (24 samples × 8 assays = 192 results)
  const passRanges: Record<number, [number, number]> = {
    1: [97.0, 100.0], 2: [0.0, 2.0], 3: [18.0, 22.0], 4: [0.0, 0.5],
    5: [80.0, 120.0], 6: [270, 310], 7: [6.5, 7.2],   8: [0, 6000],
  }
  const unitMap: Record<number, string> = {
    1:'%', 2:'%', 3:'mg/mL', 4:'EU/mL', 5:'% Ref', 6:'mOsm/kg', 7:'pH units', 8:'particles/mL',
  }

  const samplesRows = await sql`SELECT id FROM lims_samples ORDER BY id`

  for (const sample of samplesRows) {
    for (let assayId = 1; assayId <= 8; assayId++) {
      const [lo, hi] = passRanges[assayId]
      const oos = seededRand() < 0.10
      const value = oos
        ? parseFloat((seededRand() < 0.5 ? lo - Math.abs(lo) * 0.05 : hi + Math.abs(hi) * 0.05).toFixed(3))
        : parseFloat((lo + (hi - lo) * 0.1 + seededRand() * (hi - lo) * 0.8).toFixed(3))
      const passFail = oos ? 'Fail' : 'Pass'
      const instrId = Math.floor(seededRand() * 5) + 1

      await sql`
        INSERT INTO lims_results (sample_id, assay_id, instrument_id, value, unit, pass_fail, analyst, run_date, notes)
        VALUES (
          ${(sample as { id: number }).id}, ${assayId}, ${instrId},
          ${value}, ${unitMap[assayId]}, ${passFail},
          ${seededChoice(analysts)},
          ${daysAgo(Math.floor(seededRandRange(1, 300)))},
          NULL
        )
      `
    }
  }

  console.log('  LIMS: 4 compounds, 24 samples, 192 results')
}

// ---------------------------------------------------------------------------
// QMS
// ---------------------------------------------------------------------------

async function seedQms() {
  await sql`
    INSERT INTO qms_products (name, formulation_type, strength, route_of_admin, target_indication) VALUES
    ('Nexivab',  'Liquid Concentrate', '25 mg/mL', 'IV Infusion', 'NSCLC, Melanoma'),
    ('Keltara',  'Lyophilized Powder',  '20 mg vial', 'IV Infusion', 'HER2+ Breast Cancer'),
    ('Zomaclib', 'Film-coated Tablet',  '50 mg',      'Oral',        'HR+ Breast Cancer')
  `

  // Specifications
  const specDefs: [number, string, number, number, string, string][] = [
    [1, 'HPLC Purity',         97.0, 100.0, '%',       'RP-HPLC USP <621>'],
    [1, 'SEC Aggregate',        0.0,   2.0, '%',       'SEC-HPLC'],
    [1, 'Protein Concentration',23.0,  27.0,'mg/mL',   'BCA Assay'],
    [1, 'Endotoxin',            0.0,   0.5, 'EU/mL',   'LAL Kinetic'],
    [1, 'Bioassay Potency',    80.0, 120.0, '% Ref',   'Cell-Based'],
    [1, 'Osmolality',         270.0, 310.0, 'mOsm/kg', 'Vapro Osmometer'],
    [1, 'pH',                   6.5,   7.2, 'pH',      'Potentiometric'],
    [2, 'HPLC Purity',         98.0, 100.0, '%',       'RP-HPLC'],
    [2, 'Reconstitution Time',  0.0,   5.0, 'min',     'Visual Inspection'],
    [2, 'Moisture Content',     0.0,   2.0, '%',       'KF Coulometric'],
    [2, 'Protein Concentration',19.0,  21.0,'mg/mL',   'UV Absorbance'],
    [2, 'Bioassay Potency',    75.0, 125.0, '% Ref',   'ELISA'],
    [3, 'Assay',               98.0, 102.0, '%',       'RP-HPLC'],
    [3, 'Dissolution (30 min)',80.0, 100.0, '%',       'USP Apparatus II'],
    [3, 'Related Substances',   0.0,   0.2, '%',       'RP-HPLC'],
    [3, 'Water Content',        0.0,   3.0, '%',       'KF'],
  ]
  for (const [pid, param, lo, hi, unit, method] of specDefs) {
    await sql`
      INSERT INTO qms_specifications (product_id, parameter, min_value, max_value, unit, test_method)
      VALUES (${pid}, ${param}, ${lo}, ${hi}, ${unit}, ${method})
    `
  }

  // Batches (20)
  const productCycle = [1,1,2,1,3,2,1,3,2,1,1,2,3,1,2,1,3,2,1,1]
  const statuses = ['Released','Released','Released','In Review','On Hold','Released']
  const prefixes: Record<number, string> = {1:'NXV', 2:'KLT', 3:'ZOM'}

  let mfgBase = new Date()
  mfgBase.setDate(mfgBase.getDate() - 400)

  for (let i = 0; i < productCycle.length; i++) {
    const pid = productCycle[i]
    const mfgDate = new Date(mfgBase)
    mfgDate.setDate(mfgDate.getDate() + i * 18)
    const expDate = new Date(mfgDate)
    expDate.setDate(expDate.getDate() + 730)
    const year = 2024 + Math.floor(i / 12)
    const lotNum = `${prefixes[pid]}-${year}-${String((i % 12) + 1).padStart(3,'0')}`

    await sql`
      INSERT INTO qms_batches (product_id, lot_number, manufacture_date, expiry_date, batch_size_kg, status)
      VALUES (
        ${pid}, ${lotNum},
        ${mfgDate.toISOString().split('T')[0]},
        ${expDate.toISOString().split('T')[0]},
        ${parseFloat(seededRandRange(2, 8).toFixed(2))},
        ${seededChoice(statuses)}
      )
    `
  }

  // Deviations — same as lattice-poc seed
  const devData: [number, string, string, string, string, string, string, string|null][] = [
    [3,  'DEV-2025-001', 'Temperature excursion during cold chain transport. Unit refrigerator alarm triggered at +12°C for 4 hours.',                'Major',    'Equipment failure — temperature logger malfunction',        'Closed', daysAgo(310), daysAgo(270)],
    [5,  'DEV-2025-002', 'HPLC purity result 96.2% against spec ≥97.0%. Single replicate, repeat analysis pending.',                                'Major',    'Column degradation — mobile phase pH drift',                 'Closed', daysAgo(290), daysAgo(250)],
    [8,  'DEV-2025-003', 'Bioassay potency result 76% (spec 80-120%). Repeated; second result 118%. Assignable cause investigation.',                'Critical', 'Cell passage number exceeded — cell bank refresh required',  'Open',   daysAgo(240), null],
    [10, 'DEV-2025-004', 'Batch yield 1.8 kg against target 4.0 kg. Process step 3 (diafiltration) membrane integrity failure.',                     'Critical', 'Membrane defect — supplier quality issue (Lot TF-8821)',     'Open',   daysAgo(180), null],
    [12, 'DEV-2025-005', 'Endotoxin result 0.62 EU/mL (spec ≤0.5). Repeat in progress. Potential BET reagent sensitivity issue.',                   'Major',    'Pending investigation',                                      'Open',   daysAgo(45),  null],
    [14, 'DEV-2025-006', 'Documentation error — batch record page 12 missing analyst signature. Administrative deviation.',                          'Minor',    'Training gap — new analyst unfamiliar with SOP QA-112',      'Closed', daysAgo(120), daysAgo(110)],
    [16, 'DEV-2025-007', 'Sub-visible particle count 8,200/mL (spec ≤6,000). Linked to vial washing equipment maintenance gap.',                     'Major',    'Vial washer nozzle blockage — maintenance schedule overdue', 'Open',   daysAgo(60),  null],
    [18, 'DEV-2025-008', 'SEC aggregate 2.3% (spec ≤2.0%). Marginally OOS. Root cause: hold time extension during manufacturing.',                   'Minor',    'Hold time exceeded SOP limit by 2 hours',                    'Closed', daysAgo(95),  daysAgo(80)],
  ]
  for (const [batchId, devNum, desc, sev, rc, status, opened, closed] of devData) {
    await sql`
      INSERT INTO qms_deviations (batch_id, deviation_number, description, severity, root_cause, status, opened_date, closed_date)
      VALUES (${batchId}, ${devNum}, ${desc}, ${sev}, ${rc}, ${status}, ${opened}, ${closed})
    `
  }

  // CAPAs
  const capaData: [number, string, string, string, string, string, string|null][] = [
    [1, 'CAPA-2025-001', 'Replace all cold chain temperature loggers with dual-redundant units. Update SOP QA-045 section 7.', 'J. Martinez', daysFromNow(-200), 'Closed', 'Effective — zero excursions in 6 months post-implementation'],
    [2, 'CAPA-2025-002', 'Implement column lifetime tracking system. Add column wash step after every 50 injections.', 'S. Kim', daysFromNow(-150), 'Closed', 'Effective — HPLC purity trending improved'],
    [3, 'CAPA-2025-003', 'Establish cell bank passage limits in SOP. Generate new working cell bank (WCB-2025-03).', 'M. Okonkwo', daysFromNow(30), 'Open', null],
    [4, 'CAPA-2025-004', 'Audit membrane supplier qualification. Add incoming QC test for membrane integrity before use.', 'R. Patel', daysFromNow(15), 'Open', null],
    [5, 'CAPA-2025-005', 'Requalify BET reagent lot. Run positive product control at 2x concentration.', 'L. Chen', daysFromNow(7), 'Open', null],
    [6, 'CAPA-2025-006', 'GMP training refresh for all analysts. Add dual-verification step for batch record signatures.', 'A. Reyes', daysFromNow(-80), 'Closed', 'Effective — zero documentation deviations in 90 days'],
    [7, 'CAPA-2025-007', 'Revise vial washer PM schedule from quarterly to monthly. Add pre-batch nozzle integrity check.', 'J. Martinez', daysFromNow(21), 'Open', null],
    [8, 'CAPA-2025-008', 'Update hold time SOP to include 2-hour buffer with mandatory approval. Retrain manufacturing team.', 'S. Kim', daysFromNow(-55), 'Closed', 'Effective'],
  ]
  for (const [devId, capaNum, action, owner, due, status, eff] of capaData) {
    await sql`
      INSERT INTO qms_capas (deviation_id, capa_number, action_description, owner, due_date, status, effectiveness_check)
      VALUES (${devId}, ${capaNum}, ${action}, ${owner}, ${due}, ${status}, ${eff})
    `
  }

  await sql`
    INSERT INTO qms_audits (type, auditor, date, department, findings_count, critical_count, status) VALUES
    ('Internal GMP Audit',    'Quality Assurance Team',   ${daysAgo(320)}, 'Manufacturing',      8, 1, 'Closed'),
    ('Partner Site Audit',    'External QA Consultant',   ${daysAgo(210)}, 'QC Laboratory',      5, 0, 'Closed'),
    ('Regulatory Mock Audit', 'Internal QA + Regulatory', ${daysAgo(150)}, 'All Departments',   12, 2, 'Closed'),
    ('Internal GMP Audit',    'Quality Assurance Team',   ${daysAgo(60)},  'Warehouse/Logistics', 3, 0, 'Open')
  `

  console.log('  QMS: 3 products, 20 batches, 8 deviations, 8 CAPAs')
}

// ---------------------------------------------------------------------------
// Rosetta
// ---------------------------------------------------------------------------

async function seedRosetta() {
  await sql`
    INSERT INTO rosetta_term_map (source_system, source_term, canonical_term, ontology_code, confidence) VALUES
    ('LIMS', 'HPLC Purity',           'Purity by RP-HPLC',       'CHEMINF:000455', 1.0),
    ('QMS',  'HPLC Purity',           'Purity by RP-HPLC',       'CHEMINF:000455', 1.0),
    ('LIMS', 'SEC Aggregate',         'Aggregation by SEC',       'MS:1001861',     1.0),
    ('QMS',  'SEC Aggregate',         'Aggregation by SEC',       'MS:1001861',     1.0),
    ('LIMS', 'Protein Concentration', 'Protein Content',          'BAO:0002624',    1.0),
    ('QMS',  'Protein Concentration', 'Protein Content',          'BAO:0002624',    1.0),
    ('LIMS', 'Endotoxin',             'Bacterial Endotoxin',      'NCIT:C71572',    1.0),
    ('QMS',  'Endotoxin',             'Bacterial Endotoxin',      'NCIT:C71572',    1.0),
    ('LIMS', 'Bioassay Potency',      'Relative Potency',         'NCIT:C41394',    1.0),
    ('QMS',  'Bioassay Potency',      'Relative Potency',         'NCIT:C41394',    1.0),
    ('LIMS', 'Sub-Visible Particles', 'Subvisible Particulates',  'NCIT:C134010',   1.0),
    ('LIMS', 'Osmolality',            'Osmolality',               'NCIT:C64547',    1.0),
    ('QMS',  'Osmolality',            'Osmolality',               'NCIT:C64547',    1.0),
    ('LIMS', 'Pass',                  'Conforming',               NULL,             1.0),
    ('QMS',  'Released',              'Conforming',               NULL,             1.0),
    ('QMS',  'On Hold',               'Non-Conforming',           NULL,             0.9),
    ('LIMS', 'Fail',                  'Non-Conforming',           NULL,             1.0),
    ('QMS',  'In Review',             'Pending',                  NULL,             1.0),
    ('LIMS', 'Drug Substance',        'Bulk Drug Substance',      'NCIT:C48817',    1.0),
    ('QMS',  'Major',                 'Major Deviation',          'GMP:DEV-MAJ',    1.0),
    ('QMS',  'Critical',              'Critical Deviation',       'GMP:DEV-CRIT',   1.0),
    ('QMS',  'Minor',                 'Minor Deviation',          'GMP:DEV-MIN',    1.0)
  `

  await sql`
    INSERT INTO rosetta_unit_conversions (from_unit, to_unit, factor, addend) VALUES
    ('mg/mL',    'g/L',      1.0,    0),
    ('g/L',      'mg/mL',    1.0,    0),
    ('EU/mL',    'IU/mL',    10.0,   0),
    ('mOsm/kg',  'Osm/kg',   0.001,  0),
    ('% Ref',    '%',        1.0,    0),
    ('pH units', 'pH',       1.0,    0),
    ('g',        'mg',       1000.0, 0),
    ('mg',       'g',        0.001,  0),
    ('kg',       'g',        1000.0, 0)
  `

  await sql`
    INSERT INTO rosetta_compound_aliases (canonical_name, alias, source_system) VALUES
    ('XB-441', 'Nexivab',    'QMS'),
    ('XB-441', 'XB441',      'ELN'),
    ('XB-441', 'anti-PD-L1', 'CTMS'),
    ('KL-872', 'Keltara',    'QMS'),
    ('KL-872', 'KL872',      'ELN'),
    ('KL-872', 'HER2-ADC',   'CTMS'),
    ('ZM-103', 'Zomaclib',   'QMS'),
    ('ZM-103', 'CDK4/6i',    'CTMS'),
    ('AB-290', 'AB290',       'ELN')
  `

  console.log('  Rosetta: 22 term mappings, 9 unit conversions, 9 aliases')
}

// ---------------------------------------------------------------------------
// Companies / Personas / Context
// ---------------------------------------------------------------------------

const LIMS_SKILL_CONTENT = `When asked about analytical results, samples, or assay data:

1. Use lims_search_samples to locate the relevant sample set before pulling results.
2. Use lims_get_assay_results with specific assay names — do not retrieve all results at once.
3. Use lims_get_oos_results when investigating failures or building a deviation narrative.
4. Use lims_compare_compound_results when the user asks about trends or cross-batch patterns.
5. Use rosetta_normalize_term to map assay names before presenting cross-system comparisons.

When presenting results, always include: compound, sample name, assay, value, unit, pass/fail, and run date. Format as a table.

Flag any result where pass_fail = "Fail" in bold or with a clear marker.`

const QMS_SKILL_CONTENT = `When asked about deviations, batch status, or quality events:

1. Use qms_get_deviations filtered by severity and status. Distinguish open vs closed.
2. Use qms_get_open_capas to surface any overdue corrective actions. Flag anything past due date.
3. Use qms_check_batch_release when the user wants to know if a batch can be released.
4. Use qms_get_specifications to show acceptance limits alongside actual results.
5. Use rosetta_standardize_status to normalize QMS status terms when comparing against LIMS results.

Severity hierarchy: Critical > Major > Minor. Escalate Critical deviations prominently.

When listing CAPAs, always show: owner, due date, days until due (or overdue by X days), and effectiveness check status.`

const BASE_CONTEXT = `You are an enterprise AI assistant with access to MCP tools that query data systems directly. Never guess at data values — always query the tools.

## How you work

- Use tools to query the data systems directly. Show your sources: which tool you called, what filters you applied.
- When a question spans multiple systems (e.g. LIMS results + QMS deviations), query both and use Rosetta to normalize terminology before comparing.
- Present results as structured tables where possible. Use clear column headers.
- Flag anything that looks like a risk: open deviations, failed results, overdue CAPAs, OOS trends.
- Be concise in reasoning but thorough in data.

## What you do not do

- You do not write to any system. All tools are read-only.
- You do not make regulatory decisions. You surface information; the human decides.
- You do not fabricate data. If a query returns no results, say so.`

const BLUEPRINT_BATCH_RELEASE_CONTENT = `Follow these steps when the user asks about batch release readiness:

**Step 1 — Get batch record from QMS**
Use qms_get_batch or qms_check_batch_release to retrieve the batch record, current status, and any open deviations.

**Step 2 — Get specifications**
Use qms_get_specifications for the product to know the acceptance limits for each parameter.

**Step 3 — Pull release testing results from LIMS**
Use lims_search_samples to find the drug product/drug substance sample for this lot, then lims_get_assay_results for all assays.

**Step 4 — Compare results against specifications**
For each specification parameter, find the corresponding LIMS result. Use rosetta_normalize_term to match parameter names across systems. Flag any result that is OOS or missing.

**Step 5 — Render a release decision table**

| Parameter | Specification | Result | Unit | Status |
|---|---|---|---|---|
| HPLC Purity | ≥ 97.0% | 98.4% | % | PASS |
| Endotoxin | ≤ 0.5 EU/mL | 0.12 | EU/mL | PASS |

**Step 6 — Go/No-Go recommendation**
State clearly: RELEASE RECOMMENDED or RELEASE BLOCKED, with reasons.
If blocked, list: open deviations, OOS results, or missing data.`

const DEVIATION_INVESTIGATION_CONTENT = `Follow these steps when the user asks to investigate a deviation, OOS result, or batch quality event:

**Step 1 — Find the deviation in QMS**
Use qms_get_deviations to retrieve the full deviation record including description, severity, root cause, and status.

**Step 2 — Identify affected batches and products**
Note the lot number, product, and manufacture date from the deviation record.

**Step 3 — Pull LIMS results for affected samples**
Use lims_search_samples to find samples corresponding to the affected lot, then lims_get_assay_results to retrieve all analytical results. Flag any failures.

**Step 4 — Normalize terminology via Rosetta**
Use rosetta_normalize_term to map QMS deviation terms and LIMS result statuses to canonical forms. Use rosetta_standardize_status to align pass/fail designations across systems.

**Step 5 — Check open CAPAs**
Use qms_get_open_capas to surface any corrective actions linked to this deviation. Flag overdue CAPAs.

**Step 6 — Synthesize**
Present a structured investigation summary:
- Deviation number, severity, description, root cause
- Affected lot(s) and product
- Analytical results table (all assays, pass/fail highlighted)
- Open CAPAs with owner and due date
- Risk assessment: is this batch releasable? Are there systemic patterns?`

// ── Demo (root default) ──────────────────────────────────────────────────────

const DEMO_BASE_CONTEXT = `You are AgentOS — a context-aware enterprise AI assistant. You have access to live data tools and pre-loaded skill modules. You reason step by step, cite your sources, and present results as structured tables.

## Core behavior
- Query tools before answering data questions. Never fabricate values.
- When a question spans multiple systems, query all relevant tools and reconcile results.
- Flag anomalies, risks, and items requiring attention prominently.
- Be concise in prose but complete in data.`

const DEMO_SKILL_OVERVIEW = `When the user asks what tools or context you have loaded:

1. List each active skill/blueprint by name and one-sentence description.
2. List each active MCP tool server and the number of tools available.
3. Show estimated token budget consumed vs available.
4. Offer to demonstrate any capability with a sample query.

Keep the response structured and scannable.`

// ── Lattice (Biologics Manufacturing — mirrors lattice-poc exactly) ──────────

const LATTICE_BASE_CONTEXT = `You are Lattice, a federated intelligence system for biologics manufacturing.

You connect process data across systems to support tech transfer, deviation investigations, batch release decisions, and cross-site comparisons. You have access to MCP tools that query local data systems — LIMS, QMS, and Rosetta for cross-system normalization.

## How you work

- Use MCP tools to query the data systems directly. Never guess at data values.
- When a question spans multiple systems (e.g. LIMS results + QMS deviations), query both and use Rosetta to normalize terminology and units before comparing.
- Always show your sources: which system you queried, what filters you applied, how many records were returned.
- Present results as structured tables where possible. Use clear column headers.
- Flag anything that looks like a risk: open deviations, failed results, overdue CAPAs, OOS trends.
- Be concise in your reasoning but thorough in the data. The people using you are scientists and quality professionals — they want the data, not a summary of the data.

## What you do not do

- You do not write to any system. All tools are read-only.
- You do not make regulatory decisions. You surface information; the human decides.
- You do not fabricate data. If a query returns no results, say so.`

// ── Lancaster Investments (Financial Services) ───────────────────────────────

const LANCASTER_BASE_CONTEXT = `You are the Lancaster Portfolio Intelligence Assistant — an AI analyst for portfolio monitoring, investment research, and risk management.

## How you work
- Analyze portfolio exposure, performance attribution, and risk concentration using structured data.
- Always present figures with units, as-of dates, and comparison benchmarks.
- When discussing performance, show absolute return AND benchmark-relative return.
- Be precise about time horizons: MTD, QTD, YTD, 1Y, 3Y, inception.

## What you do not do
- You do not provide investment advice or buy/sell recommendations to external parties.
- You do not guarantee forward-looking projections.
- You do not share client-level data in aggregate reports without anonymization.`

const LANCASTER_PORTFOLIO_SKILL = `When asked about portfolio performance or returns:

1. Pull total portfolio return for the requested period. Compare to relevant benchmark (S&P 500, Russell 2000, MSCI ACWI, custom).
2. Break down attribution: asset class → sector → individual position.
3. Identify top 5 contributors and top 5 detractors by absolute P&L.
4. Show allocation drift vs target: current weight vs IPS target for each asset class.
5. Flag any position exceeding concentration limits (typically >5% single name, >25% single sector).

Table format: Position | Weight | Return | Contribution | vs Benchmark | Limit Status`

const LANCASTER_RISK_SKILL = `When asked about risk, drawdown, or volatility:

1. Calculate portfolio volatility (annualized std dev) vs benchmark and prior period.
2. Show max drawdown for trailing 12 months: peak date, trough date, recovery status.
3. Compute Value at Risk (VaR) at 95% and 99% confidence intervals (1-day and 10-day).
4. Break down beta exposure by sector and asset class.
5. Identify correlated positions (r > 0.85) that create hidden concentration risk.

Risk thresholds: Flag if portfolio VaR (95%, 1-day) exceeds 1.5% of NAV. Flag if any single sector beta > 1.4.`

const LANCASTER_COMPLIANCE_SKILL = `When asked about compliance, limits, or investment policy:

1. Check all current positions against IPS constraints: sector limits, single-name limits, geographic limits, credit quality floors.
2. Report any soft or hard limit breaches. Distinguish between temporary drift and structural breach.
3. Show restricted securities list and flag any current holdings that appear on it.
4. Summarize upcoming covenant dates, client reporting deadlines, and rebalancing windows.
5. Check liquidity: what % of the portfolio can be liquidated within 1 day, 5 days, 30 days at current market depth.

Always include an "Action Required" column: Breach | Severity | Deadline | Owner.`

async function seedCompanies() {
  const FINDORFF_BRAND = JSON.stringify({ tagline: 'by MadStack', chat_welcome: 'Findorff QC Agent ready. Query LIMS and QMS data.' })
  const DEMO_BRAND = JSON.stringify({ tagline: 'by MadStack', chat_welcome: 'AgentOS ready. What would you like to explore?', logo_url: '/madstack-icon.svg' })
  const LATTICE_BRAND = JSON.stringify({ tagline: 'by MadStack', chat_welcome: 'Lattice ready. Query LIMS, QMS, and Rosetta.' })
  const LANCASTER_BRAND = JSON.stringify({ tagline: 'by MadStack', chat_welcome: 'Lancaster Portfolio Intelligence ready.', bg: '#f0fdf4', surface: '#ffffff', border: '#bbf7d0' })

  // Insert company first with no persona, then persona, then link back
  await sql`
    INSERT INTO companies (id, name, description, color, brand_config, base_context, default_persona_id, admin_key) VALUES
    (
      'findorff',
      'Findorff',
      'Biologics manufacturing — LIMS, QMS, and Rosetta cross-system intelligence',
      '#2563eb',
      ${FINDORFF_BRAND}::jsonb,
      ${BASE_CONTEXT},
      NULL,
      'findorff-admin'
    )
  `

  await sql`
    INSERT INTO personas (id, company_id, name, description) VALUES
    ('findorff-default', 'findorff', 'QC Analyst', 'Quality control analyst with LIMS and QMS access')
  `

  await sql`
    UPDATE companies SET default_persona_id = 'findorff-default' WHERE id = 'findorff'
  `

  await sql`
    INSERT INTO persona_modules (persona_id, repo_id, path, type, name, description, tokens, enabled, content) VALUES
    (
      'findorff-default', 'local',
      'skills/lims-analysis.md', 'skill',
      'LIMS Analysis', 'Analytical result querying, OOS trend detection, cross-batch comparisons',
      400, true, ${LIMS_SKILL_CONTENT}
    ),
    (
      'findorff-default', 'local',
      'skills/qms-investigation.md', 'skill',
      'QMS Investigation', 'Deviation tracking, CAPA status, batch release, audit findings',
      450, true, ${QMS_SKILL_CONTENT}
    )
  `

  // Enable all three tool groups for Findorff
  const toolIds = [
    'lims_list_compounds', 'lims_search_samples', 'lims_get_assay_results',
    'lims_get_oos_results', 'lims_get_instrument_status', 'lims_compare_compound_results',
    'qms_list_products', 'qms_get_batch', 'qms_list_batches', 'qms_get_deviations',
    'qms_get_open_capas', 'qms_get_specifications', 'qms_check_batch_release', 'qms_get_audit_findings',
    'rosetta_normalize_term', 'rosetta_convert_units', 'rosetta_resolve_compound',
    'rosetta_list_term_mappings', 'rosetta_standardize_status',
  ]
  for (const toolId of toolIds) {
    await sql`
      INSERT INTO company_tools (company_id, tool_id, enabled) VALUES ('findorff', ${toolId}, true)
    `
  }

  // Seed repos
  await sql`
    INSERT INTO repos (id, name, description, owner, scope, verified, module_count) VALUES
    (
      'findorff-skills',
      'Findorff Skills & Blueprints',
      'QC Analyst skills and investigation blueprints for Findorff biologics manufacturing',
      'MadStack',
      'private',
      true,
      4
    )
  `

  await sql`
    INSERT INTO repo_modules (repo_id, path, type, name, description, tokens, content) VALUES
    (
      'findorff-skills', 'skills/lims-analysis.md', 'skill', 'LIMS Analysis',
      'Analytical result querying, OOS trend detection, cross-batch comparisons', 400,
      ${LIMS_SKILL_CONTENT}
    ),
    (
      'findorff-skills', 'skills/qms-investigation.md', 'skill', 'QMS Investigation',
      'Deviation tracking, CAPA status, batch release, audit findings', 450,
      ${QMS_SKILL_CONTENT}
    ),
    (
      'findorff-skills', 'blueprints/batch-release.md', 'blueprint', 'Batch Release',
      'Aggregate release testing results and QMS status into a go/no-go summary', 550,
      ${BLUEPRINT_BATCH_RELEASE_CONTENT}
    ),
    (
      'findorff-skills', 'blueprints/deviation-investigation.md', 'blueprint', 'Deviation Investigation',
      'Cross-system investigation linking QMS deviation to LIMS analytical data', 600,
      ${DEVIATION_INVESTIGATION_CONTENT}
    )
  `

  await sql`
    INSERT INTO company_repos (company_id, repo_id) VALUES ('findorff', 'findorff-skills')
  `

  // ── Demo company (root default) ──────────────────────────────────────────
  await sql`
    INSERT INTO companies (id, name, description, color, brand_config, base_context, admin_key) VALUES
    ('demo', 'AgentOS', 'General-purpose enterprise AI assistant demo', '#f97316', ${DEMO_BRAND}::jsonb, ${DEMO_BASE_CONTEXT}, 'demo-admin')
  `
  await sql`
    INSERT INTO personas (id, company_id, name, description) VALUES
    ('demo-default', 'demo', 'Enterprise Assistant', 'General-purpose analyst with access to all available tools and context')
  `
  await sql`UPDATE companies SET default_persona_id = 'demo-default' WHERE id = 'demo'`
  await sql`
    INSERT INTO persona_modules (persona_id, type, name, description, tokens, enabled, content) VALUES
    ('demo-default', 'skill', 'Capability Overview', 'How to summarize loaded skills, tools, and context', 150, true, ${DEMO_SKILL_OVERVIEW}),
    ('demo-default', 'skill', 'LIMS Analysis', 'Analytical result querying, OOS trend detection, cross-batch comparisons', 400, true, ${LIMS_SKILL_CONTENT}),
    ('demo-default', 'skill', 'QMS Investigation', 'Deviation tracking, CAPA status, batch release, audit findings', 450, true, ${QMS_SKILL_CONTENT})
  `
  for (const toolId of [
    'lims_list_compounds', 'lims_search_samples', 'lims_get_assay_results',
    'lims_get_oos_results', 'lims_get_instrument_status', 'lims_compare_compound_results',
    'qms_list_products', 'qms_get_batch', 'qms_list_batches', 'qms_get_deviations',
    'qms_get_open_capas', 'qms_get_specifications', 'qms_check_batch_release', 'qms_get_audit_findings',
    'rosetta_normalize_term', 'rosetta_convert_units', 'rosetta_resolve_compound',
    'rosetta_list_term_mappings', 'rosetta_standardize_status',
  ]) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled) VALUES ('demo', ${toolId}, true)`
  }

  // ── Lattice (Biologics manufacturing — mirrors lattice-poc) ─────────────
  await sql`
    INSERT INTO companies (id, name, description, color, brand_config, base_context, admin_key) VALUES
    ('lattice', 'Lattice', 'Federated intelligence for biologics manufacturing — LIMS, QMS, and Rosetta', '#212154', ${LATTICE_BRAND}::jsonb, ${LATTICE_BASE_CONTEXT}, 'lattice-admin')
  `
  await sql`
    INSERT INTO personas (id, company_id, name, description) VALUES
    ('lattice-analyst', 'lattice', 'QC Analyst', 'Quality control analyst with full LIMS, QMS, and Rosetta access')
  `
  await sql`UPDATE companies SET default_persona_id = 'lattice-analyst' WHERE id = 'lattice'`
  await sql`
    INSERT INTO persona_modules (persona_id, type, name, description, tokens, enabled, content) VALUES
    ('lattice-analyst', 'skill', 'LIMS Analysis', 'Analytical result querying, OOS trend detection, cross-batch comparisons', 400, true, ${LIMS_SKILL_CONTENT}),
    ('lattice-analyst', 'skill', 'QMS Investigation', 'Deviation tracking, CAPA status, batch release, audit findings', 450, true, ${QMS_SKILL_CONTENT}),
    ('lattice-analyst', 'blueprint', 'Batch Release', 'Aggregate release testing results and QMS status into a go/no-go summary', 550, true, ${BLUEPRINT_BATCH_RELEASE_CONTENT}),
    ('lattice-analyst', 'blueprint', 'Deviation Investigation', 'Cross-system investigation linking QMS deviation to LIMS analytical data', 600, true, ${DEVIATION_INVESTIGATION_CONTENT})
  `
  // Lattice: all tools enabled (same as findorff — this is the direct lattice-poc port)
  for (const toolId of [
    'lims_list_compounds', 'lims_search_samples', 'lims_get_assay_results',
    'lims_get_oos_results', 'lims_get_instrument_status', 'lims_compare_compound_results',
    'qms_list_products', 'qms_get_batch', 'qms_list_batches', 'qms_get_deviations',
    'qms_get_open_capas', 'qms_get_specifications', 'qms_check_batch_release', 'qms_get_audit_findings',
    'rosetta_normalize_term', 'rosetta_convert_units', 'rosetta_resolve_compound',
    'rosetta_list_term_mappings', 'rosetta_standardize_status',
  ]) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled) VALUES ('lattice', ${toolId}, true)`
  }
  // Link lattice to the findorff-skills repo (same skill content)
  await sql`INSERT INTO company_repos (company_id, repo_id) VALUES ('lattice', 'findorff-skills') ON CONFLICT DO NOTHING`

  // ── Lancaster Investments ─────────────────────────────────────────────────
  await sql`
    INSERT INTO companies (id, name, description, color, brand_config, base_context, admin_key) VALUES
    ('lancaster-investments', 'Lancaster', 'Investment portfolio monitoring, risk analysis, and compliance intelligence', '#166534', ${LANCASTER_BRAND}::jsonb, ${LANCASTER_BASE_CONTEXT}, 'lancaster-admin')
  `
  await sql`
    INSERT INTO personas (id, company_id, name, description) VALUES
    ('lancaster-portfolio', 'lancaster-investments', 'Portfolio Analyst', 'Investment analyst — performance attribution, risk monitoring, compliance checks')
  `
  await sql`UPDATE companies SET default_persona_id = 'lancaster-portfolio' WHERE id = 'lancaster-investments'`
  await sql`
    INSERT INTO persona_modules (persona_id, type, name, description, tokens, enabled, content) VALUES
    ('lancaster-portfolio', 'skill', 'Portfolio Performance', 'Return attribution, contributor/detractor analysis, benchmark comparison', 430, true, ${LANCASTER_PORTFOLIO_SKILL}),
    ('lancaster-portfolio', 'skill', 'Risk & Volatility', 'VaR, drawdown analysis, beta exposure, correlation risk', 450, true, ${LANCASTER_RISK_SKILL}),
    ('lancaster-portfolio', 'blueprint', 'Compliance Review', 'IPS limit checks, breach tracking, liquidity analysis', 480, true, ${LANCASTER_COMPLIANCE_SKILL})
  `
  // Lancaster uses Rosetta for normalizing financial terminology across data sources
  for (const toolId of [
    'rosetta_normalize_term', 'rosetta_convert_units', 'rosetta_resolve_compound',
  ]) {
    await sql`INSERT INTO company_tools (company_id, tool_id, enabled) VALUES ('lancaster-investments', ${toolId}, true)`
  }

  console.log('  Companies: findorff, demo, lattice, lancaster-investments seeded')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding enterprise-assistant database...')
  await createTables()
  await clearData()
  await seedLims()
  await seedQms()
  await seedRosetta()
  await seedCompanies()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
