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
      {/* The identity block scrolls away; the tab row and the view toggle stay
          pinned, so they are reachable from anywhere in a long deadline list
          without scrolling back to the top. */}
      <div className="bg-surface">
        <div className="mx-auto max-w-2xl px-5 pt-5 pb-4">
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
      </div>

      <header className="sticky top-0 z-20 border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5">
          <PortalNav token={token} needsAction={carrier.documents.length} />
          <div className="shrink-0 pb-1.5">
            <ViewToggle clientToken={token} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>

      <footer className="mx-auto max-w-2xl px-5 pb-10 text-[13px] text-ink-faint">
        Questions? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
      </footer>
    </div>
  )
}
