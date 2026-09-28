'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ViewToggle } from './ViewToggle'

export interface NavItem {
  href: string
  label: string
  /** Highlight only on this exact path, not its children (e.g. an overview page). */
  exact?: boolean
  /** Count shown as a pill beside the label; hidden when zero. */
  badge?: number
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

/**
 * The shared frame for both audiences — staff console and client portal.
 *
 * Same sidebar, same scroll behaviour, same view toggle; only the navigation,
 * the brand block, and the footer note differ. What each audience *sees* is
 * decided by the nav it is handed, not by a different layout.
 */
export function AppShell({
  children,
  nav,
  home,
  footerNote,
  clientToken,
}: {
  children: ReactNode
  nav: NavGroup[]
  /** Brand block at the top of the sidebar, linking to the audience's home page. */
  home: { href: string; title: string; subtitle: string }
  footerNote?: ReactNode
  /** Demo carrier whose client view the toggle jumps to. */
  clientToken?: string | null
}) {
  const pathname = usePathname()
  const isActive = (item: NavItem) =>
    pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`))
  const items = nav.flatMap((group) => group.items)

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
          <Link href={home.href} className="block">
            <div className="text-[15px] font-semibold tracking-tight text-ink">{home.title}</div>
            <div className="mt-0.5 text-[11px] text-ink-faint">{home.subtitle}</div>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {nav.map((group) => (
            <div key={group.label ?? 'root'} className="mb-5">
              {group.label && (
                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                        isActive(item)
                          ? 'bg-brand-soft font-medium text-brand'
                          : 'text-ink-soft hover:bg-canvas hover:text-ink'
                      }`}
                    >
                      {item.label}
                      <Badge count={item.badge} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-edge px-5 py-4">
          <ViewToggle clientToken={clientToken ?? null} />
          {footerNote && (
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-faint">{footerNote}</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Below `lg` the sidebar is hidden, so the nav and the toggle move into
            a compact bar of their own — the client portal is mostly read on a phone. */}
        <div className="shrink-0 border-b border-edge bg-surface lg:hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-2.5">
            <Link href={home.href} className="truncate text-[14px] font-semibold tracking-tight text-ink">
              {home.title}
            </Link>
            <ViewToggle clientToken={clientToken ?? null} />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] transition-colors ${
                  isActive(item)
                    ? 'border-brand font-medium text-ink'
                    : 'border-transparent text-ink-faint hover:text-ink-soft'
                }`}
              >
                {item.label}
                <Badge count={item.badge} />
              </Link>
            ))}
          </nav>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </div>
    </div>
  )
}

function Badge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="rounded-full bg-high px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  )
}
