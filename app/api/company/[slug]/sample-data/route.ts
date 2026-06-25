import { getSampleData } from '@/lib/sample-data'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return Response.json(await getSampleData(slug))
}
