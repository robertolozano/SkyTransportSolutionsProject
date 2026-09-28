import type { ReactNode } from 'react'
import { AppShell, type NavGroup } from '@/components/AppShell'
import { prisma } from '@/server/db'

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
    items: [{ href: '/clients', label: 'Clients' }],
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

/** Internal operations console — sidebar navigation, dense tables, staff language. */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  // The demo account the client-view toggle jumps to. In a real deployment the
  // client view is reached from a specific carrier record, not a global switch.
  const demo = await prisma.carrier.findUnique({
    where: { dotNumber: '3421569' },
    select: { portalToken: true },
  })

  return (
    <AppShell
      nav={NAV}
      home={{ href: '/dashboard', title: 'Compliance Radar', subtitle: 'Sky Transport Solutions' }}
      footerNote={
        <>
          Demo data. The client view is a
          <br />
          separate audience, shown here for
          <br />
          comparison.
        </>
      }
      clientToken={demo?.portalToken ?? null}
    >
      {children}
    </AppShell>
  )
}
