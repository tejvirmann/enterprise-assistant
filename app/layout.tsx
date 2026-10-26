import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { defaultBrandCss } from '@/lib/brand'

const sans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600'] })
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] })
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] })

export const metadata: Metadata = {
  title: { default: 'Enterprise Assistant | MadStack', template: '%s | Enterprise Assistant' },
  description: 'A context-configurable AI agent studio by MadStack: agents with access to your team’s tools and knowledge.',
  applicationName: 'Enterprise Assistant',
  authors: [{ name: 'MadStack', url: 'https://madstack.ai' }],
  // Each company environment is a private demo, so keep it out of search results.
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${defaultBrandCss()}}` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
