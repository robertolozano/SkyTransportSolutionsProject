import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Compliance Radar — Sky Transport Solutions',
  description:
    'Derives every DOT compliance deadline from the rules, models what blocks what, and surfaces the date each truck stops being legal.',
}

/**
 * Root layout holds only the document shell.
 *
 * The staff application and the client-facing view are separate route groups with
 * separate chrome — a driver opening a link from a text message should not be handed
 * an operations console.
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}
