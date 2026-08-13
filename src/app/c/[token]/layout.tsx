import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { PortalNav } from '@/components/PortalNav'
import { ViewToggle } from '@/components/ViewToggle'

/**
 * Client portal shell.
 *
 * Deliberately not the staff console: no sidebar, no dense tables, a single
 * centred column sized for a phone. The reader is an owner-operator who opened a
 * link from a text message, quite possibly at a truck stop.
 */
export default async function PortalLayout({
  children,
  params,
}: LayoutProps<'/c/[token]'>) {
  const { token } = await params

  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    select: {
      legalName: true,
      dotNumber: true,
      documents: { where: { status: 'REQUESTED' }, select: { id: true } },
    },
  })
  if (!carrier) notFound()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <div className="text-[12px] font-medium uppercase tracking-wider text-ink-faint">
              Sky Transport Solutions
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">
              {carrier.legalName}
            </h1>
            <div className="numeric mt-0.5 text-[13px] text-ink-faint">
              DOT {carrier.dotNumber}
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <ViewToggle clientToken={token} />
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-2xl px-5">
          <PortalNav token={token} needsAction={carrier.documents.length} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>

      <footer className="mx-auto max-w-2xl px-5 pb-10 text-[13px] text-ink-faint">
        Questions? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
      </footer>
    </div>
  )
}
