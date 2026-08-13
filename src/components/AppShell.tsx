'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ViewToggle } from './ViewToggle'

interface NavItem {
  href: string
  label: string
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

const NAV: NavGroup[] = [
  { label: null, items: [{ href: '/dashboard', label: 'Today' }] },
  {
    label: 'Work',
    items: [
      { href: '/deadlines', label: 'Deadlines' },
      { href: '/requests', label: 'Requests' },
      { href: '/scans', label: 'Scans' },
      { href: '/calendar', label: 'Calendar' },
    ],
  },
  {
    label: 'Book',
    items: [
      { href: '/clients', label: 'Clients' },
      { href: '/onboarding', label: 'Onboarding' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { href: '/planning', label: 'Planning' },
      { href: '/opportunities', label: 'Opportunities' },
      { href: '/rules', label: 'Rules' },
    ],
  },
]

export function AppShell({
  children,
  clientToken,
}: {
  children: ReactNode
  /** Demo carrier whose client view the toggle jumps to. */
  clientToken?: string | null
}) {
  const pathname = usePathname()

  /*
    Two independent scroll regions rather than one long page.

    The sidebar footer holds the view toggle, so in a single-scroll layout it sat
    below a 200-row table and you had to scroll the whole page to reach it. Here
    the shell is viewport-height, the nav scrolls on its own if it ever outgrows
    the sidebar, and the footer stays pinned. `overscroll-contain` stops a scroll
    that reaches the end of one pane from chaining to the other.
  */
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-edge bg-surface lg:flex">
        <div className="shrink-0 border-b border-edge px-5 py-4">
          <Link href="/dashboard" className="block">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              Compliance Radar
            </div>
            <div className="mt-0.5 text-[11px] text-ink-faint">Sky Transport Solutions</div>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {NAV.map((group) => (
            <div key={group.label ?? 'root'} className="mb-5">
              {group.label && (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                          active
                            ? 'bg-brand-soft font-medium text-brand'
                            : 'text-ink-soft hover:bg-canvas hover:text-ink'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-edge px-5 py-4">
          <ViewToggle clientToken={clientToken ?? null} />
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">
            Demo data. The client view is a
            <br />
            separate audience, shown here for
            <br />
            comparison.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Below `lg` the sidebar is hidden, which would leave the toggle
            unreachable — so it gets a compact bar of its own. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface px-5 py-2.5 lg:hidden">
          <Link href="/dashboard" className="text-[14px] font-semibold tracking-tight text-ink">
            Compliance Radar
          </Link>
          <ViewToggle clientToken={clientToken ?? null} />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </div>
    </div>
  )
}
