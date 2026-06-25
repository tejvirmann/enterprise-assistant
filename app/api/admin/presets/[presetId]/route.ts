import { sql } from '@/lib/db'
import { checkAdminSecret } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { name, description, adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`
    UPDATE presets SET
      name        = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description)
    WHERE id = ${presetId}
  `
  return Response.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params
  const { adminKey } = await req.json()

  const denied = checkAdminSecret(adminKey)
  if (denied) return denied

  await sql`DELETE FROM presets WHERE id = ${presetId}`
  return Response.json({ ok: true })
}
