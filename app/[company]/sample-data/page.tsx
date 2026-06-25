import { sql } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getSampleData } from '@/lib/sample-data'
import { SampleDataClient } from '@/components/SampleDataClient'

interface Props {
  params: Promise<{ company: string }>
}

export default async function SampleDataPage({ params }: Props) {
  const { company: slug } = await params

  const companies = await sql`SELECT id, name FROM companies WHERE id = ${slug}`
  if (!companies.length) notFound()

  const data = await getSampleData(slug)

  return <SampleDataClient companyName={companies[0].name as string} data={data} />
}
