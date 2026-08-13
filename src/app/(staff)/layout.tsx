import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { prisma } from '@/server/db'

/** Internal operations console — sidebar navigation, dense tables, staff language. */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  // The demo account the client-view toggle jumps to. In a real deployment the
  // client view is reached from a specific carrier record, not a global switch.
  const demo = await prisma.carrier.findUnique({
    where: { dotNumber: '3421569' },
    select: { portalToken: true },
  })

  return <AppShell clientToken={demo?.portalToken ?? null}>{children}</AppShell>
}
