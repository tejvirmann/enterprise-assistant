import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'
import type { BrandConfig } from '@/lib/types'

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { adminKey, name, description, color, tagline, chat_welcome, logo_url, bg, surface, border, company_admin_key, preset_id, rate_limit_per_minute, rate_limit_per_visitor_per_minute } = body

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  const brand: BrandConfig = {}
  if (tagline)      brand.tagline      = tagline
  if (chat_welcome) brand.chat_welcome = chat_welcome
  if (logo_url)     brand.logo_url     = logo_url
  if (bg)           brand.bg           = bg
  if (surface)      brand.surface      = surface
  if (border)       brand.border       = border

  await sql`
    UPDATE companies
    SET name         = ${(name ?? '').trim()},
        description  = ${description ?? null},
        color        = ${color},
        brand_config = ${JSON.stringify(brand)}::jsonb
    WHERE id = ${slug}
  `

  if (company_admin_key !== undefined && company_admin_key !== null) {
    await sql`UPDATE companies SET admin_key = ${company_admin_key} WHERE id = ${slug}`
  }

  if (preset_id !== undefined) {
    await sql`UPDATE companies SET preset_id = ${preset_id || null} WHERE id = ${slug}`
  }

  if (rate_limit_per_minute !== undefined || rate_limit_per_visitor_per_minute !== undefined) {
    await sql`
      UPDATE companies SET
        rate_limit_per_minute             = ${rate_limit_per_minute || null},
        rate_limit_per_visitor_per_minute = ${rate_limit_per_visitor_per_minute || null}
      WHERE id = ${slug}
    `
  }

  return Response.json({ ok: true })
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  // Create a new persona for this company
  const { slug } = await params
  const { adminKey, name, description } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  const id = `${slug}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
  await sql`INSERT INTO personas (id, company_id, name, description) VALUES (${id}, ${slug}, ${name.trim()}, ${description ?? null})`
  return Response.json({ id })
}
