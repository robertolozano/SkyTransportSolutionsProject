import { notFound } from 'next/navigation'
import { getCarrierByToken } from '@/server/queries'
import { Stat } from '@/components/ui'
import { CalendarSubscribe } from '../CalendarSubscribe'
import { DeadlineRow } from '../DeadlineRow'

export const dynamic = 'force-dynamic'

/**
 * Client deadline calendar.
 *
 * Grouped by month rather than rendered as a grid: a carrier has a handful of
 * dates a year, not a dense schedule, and a month grid on a phone is mostly empty
 * cells. The thing worth showing is which of these they can forget about — so
 * every row says plainly whether Sky is filing it.
 */
export default async function ClientDeadlinesPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const carrier = await getCarrierByToken(token)
  if (!carrier) notFound()

  const asOf = new Date()
  const open = carrier.obligations.filter((o) => o.status !== 'COMPLETED')
  const completed = carrier.obligations.filter((o) => o.status === 'COMPLETED')

  // Group by calendar month.
  const months = new Map<string, typeof open>()
  for (const o of open) {
    const key = `${o.dueOn.getUTCFullYear()}-${String(o.dueOn.getUTCMonth() + 1).padStart(2, '0')}`
    const list = months.get(key) ?? []
    list.push(o)
    months.set(key, list)
  }

  const monthLabel = (key: string) => {
    const [year, month] = key.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    })
  }

  const handled = open.filter((o) => o.coveredByTier).length
  const overdue = open.filter((o) => o.status === 'OVERDUE').length

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming" value={open.length} hint="Requirements on the calendar" />
        <Stat
          label="We handle"
          value={handled}
          hint={`Under your ${carrier.tier.toLowerCase()} plan`}
          tone="good"
        />
        <Stat
          label="Not in your plan"
          value={open.length - handled}
          hint="We remind you, you file"
        />
        {overdue > 0 ? (
          <Stat label="Past due" value={overdue} hint="Our office will be in touch" tone="critical" />
        ) : (
          <Stat label="Filed for you" value={completed.length} hint="Already done" />
        )}
      </div>

      {/* The calendar card stays in view beside a long list on a wide screen;
          on a phone it drops below the months, where it was before. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {[...months.entries()].map(([key, items]) => (
            <section key={key} className="mb-6 last:mb-0">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                {monthLabel(key)}
              </h2>
              <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
                {items.map((o) => (
                  <DeadlineRow key={o.id} obligation={o} asOf={asOf} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="xl:sticky xl:top-6">
          <CalendarSubscribe token={token} />
        </aside>
      </div>
    </>
  )
}
