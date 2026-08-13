import { notFound } from 'next/navigation'
import { getCarrierByToken } from '@/server/queries'
import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { CalendarSubscribe } from '../CalendarSubscribe'

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

  return (
    <>
      <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-ink">
              {open.length} upcoming {open.length === 1 ? 'requirement' : 'requirements'}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {open.filter((o) => o.coveredByTier).length} of these are handled by us under your{' '}
              {carrier.tier.toLowerCase()} plan. We&apos;ve already filed {completed.length} for
              you.
            </p>
          </div>
        </div>
      </section>

      {[...months.entries()].map(([key, items]) => (
        <section key={key} className="mb-6">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            {monthLabel(key)}
          </h2>
          <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
            {items.map((o) => {
              const days = daysBetween(asOf, o.dueOn)
              return (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[15px] text-ink">{OBLIGATION_LABELS[o.type]}</div>
                    <div className="mt-0.5 text-[13px] text-ink-faint">
                      {o.truck
                        ? `Unit ${o.truck.unitNumber}`
                        : o.driver
                          ? `${o.driver.firstName} ${o.driver.lastName}`
                          : 'Your company'}
                    </div>
                  </div>
                  <div className="numeric shrink-0 text-right text-[13px]">
                    <div className="text-ink-soft">{formatDay(o.dueOn)}</div>
                    <div
                      className={
                        o.status === 'OVERDUE'
                          ? 'text-critical'
                          : o.coveredByTier
                            ? 'text-good'
                            : 'text-medium'
                      }
                    >
                      {o.status === 'OVERDUE'
                        ? `${Math.abs(days)} days past due`
                        : o.coveredByTier
                          ? 'We handle this'
                          : 'Not in your plan'}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <CalendarSubscribe token={token} />
    </>
  )
}
