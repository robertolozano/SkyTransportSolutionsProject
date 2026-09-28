import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { AppShell } from '@/components/AppShell'
import { ensureDemoRequest } from '@/server/demo'

/**
 * Client portal shell.
 *
 * The same frame as the staff console, so the two read as one product — but
 * with three nav items, because there are exactly three things a carrier wants:
 * am I covered, what is coming, and what do you need from me. Anything more is
 * the operations console leaking into the customer's view. On a phone the
 * sidebar collapses into a tab row, since the reader is often an owner-operator
 * who opened a link from a text message at a truck stop.
 */
export default async function PortalLayout({
  children,
  params,
}: LayoutProps<'/c/[token]'>) {
  const { token } = await params
  await ensureDemoRequest(token)

  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    select: {
      legalName: true,
      dotNumber: true,
      documents: { where: { status: 'REQUESTED' }, select: { id: true } },
    },
  })
  if (!carrier) notFound()

  const base = `/c/${token}`

  return (
    <AppShell
      nav={[
        {
          label: null,
          items: [
            { href: base, label: 'Overview', exact: true },
            { href: `${base}/deadlines`, label: 'Deadlines' },
            { href: `${base}/documents`, label: 'Documents', badge: carrier.documents.length },
          ],
        },
      ]}
      home={{ href: base, title: 'Sky Transport Solutions', subtitle: 'Client portal' }}
      footerNote={
        <>
          Questions? Call (800) 498-9820,
          <br />
          Monday–Friday 9:00–5:30 Pacific.
        </>
      }
      clientToken={token}
    >
      <div className="border-b border-edge bg-surface px-5 py-5 sm:px-8">
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
          {carrier.legalName}
        </h1>
        <div className="numeric mt-0.5 text-[13px] text-ink-faint">DOT {carrier.dotNumber}</div>
      </div>

      {/* Full width, like the staff pages. Each portal page lays out its own
          columns on wide screens and stacks to a single column on a phone. */}
      <div className="px-5 py-6 sm:px-8">{children}</div>

      <footer className="px-5 pb-10 text-[13px] text-ink-faint sm:px-8 lg:hidden">
        Questions? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
      </footer>
    </AppShell>
  )
}
