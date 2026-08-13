'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Client portal navigation.
 *
 * Three tabs, because there are exactly three things a carrier wants: am I
 * covered, what is coming, and what do you need from me. Anything more is the
 * operations console leaking into the customer's view.
 */
export function PortalNav({ token, needsAction }: { token: string; needsAction: number }) {
  const pathname = usePathname()
  const base = `/c/${token}`

  const tabs = [
    { href: base, label: 'Overview' },
    { href: `${base}/deadlines`, label: 'Deadlines' },
    { href: `${base}/documents`, label: 'Documents', badge: needsAction },
  ]

  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[14px] transition-colors ${
              active
                ? 'border-brand font-medium text-ink'
                : 'border-transparent text-ink-faint hover:text-ink-soft'
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-high px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
