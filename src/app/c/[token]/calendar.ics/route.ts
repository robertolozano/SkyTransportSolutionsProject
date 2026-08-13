import { getCarrierByToken } from '@/server/queries'
import { buildCalendar, obligationEvent } from '@/server/ics'

/**
 * Subscribable calendar feed.
 *
 * This is the one route that exists because a non-React client is consuming it —
 * Google or Apple Calendar fetching over HTTP on a schedule. Everything else in the
 * app is a Server Component reading the database directly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const carrier = await getCarrierByToken(token)

  if (!carrier) {
    return new Response('Not found', { status: 404 })
  }

  const upcoming = carrier.obligations.filter((o) => o.status !== 'COMPLETED')
  const ics = buildCalendar(
    `${carrier.legalName} — Compliance Deadlines`,
    upcoming.map(obligationEvent),
  )

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="compliance-${carrier.dotNumber}.ics"`,
      // Subscribed clients poll on their own schedule; keep the copy short-lived.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
