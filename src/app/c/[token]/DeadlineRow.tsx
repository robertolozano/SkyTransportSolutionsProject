import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import type { getCarrierByToken } from '@/server/queries'

type Obligation = NonNullable<Awaited<ReturnType<typeof getCarrierByToken>>>['obligations'][number]

/**
 * One deadline as the carrier sees it — shared by the overview's "Next up" list
 * and the full deadlines page, so both always say the same thing about a row:
 * what it is, who it's for, when, and whether Sky is filing it.
 */
export function DeadlineRow({ obligation: o, asOf }: { obligation: Obligation; asOf: Date }) {
  const days = daysBetween(asOf, o.dueOn)
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5">
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
}
