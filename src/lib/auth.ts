import { sql } from './db'

export async function validateAdminKey(companyId: string, key: string | null): Promise<boolean> {
  if (!key) return false
  const rows = await sql`SELECT admin_key FROM companies WHERE id = ${companyId}`
  if (!rows.length || !rows[0].admin_key) return false
  return rows[0].admin_key === key
}

export function requireKey(isValid: boolean): Response | null {
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid or missing admin key' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
