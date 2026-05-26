import { redirect } from 'next/navigation'

// Root redirects to the demo company.
// Swap this for a scratch studio or landing page in v2.
export default function Home() {
  redirect('/findorff')
}
