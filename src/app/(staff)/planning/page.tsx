import { getPlannableObligations, getMonthlyTypeCounts } from '@/server/queries'
import { OBLIGATION_LABELS } from '@/rules'
import {
  pullForwardPlan,
  monthlyCapacityHours,
  hoursForFilings,
  CAPACITY_ASSUMPTIONS,
} from '@/rules/schedule'
import { PageHeader, Section, Card, Table, Td, Th, EmptyState } from '@/components/ui'
import type { ObligationType } from '@/rules'

export const dynamic = 'force-dynamic'

const monthLabel = (d: Date) =>
  new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' })

/**
 * Planning.
 *
 * The calendar page shows that the work arrives in waves. This page does something
 * about it: a large share of compliance work can legally be completed months early,
 * so moving it into the troughs flattens the peak without adding a single person.
 *
 * The capacity model underneath is built on stated estimates, not measurements, and
 * says so on the page rather than in a footnote.
 */
export default async function PlanningPage() {
  const [obligations, typeCounts] = await Promise.all([
    getPlannableObligations(),
    getMonthlyTypeCounts(),
  ])

  const asOf = new Date()
  const plan = pullForwardPlan(obligations, asOf)

  // Capacity: hours demanded per month against hours available.
  const hoursByMonth = new Map<string, number>()
  for (const row of typeCounts) {
    const key = new Date(row.month).toISOString().slice(0, 7)
    hoursByMonth.set(
      key,
      (hoursByMonth.get(key) ?? 0) + hoursForFilings({ [row.type]: row.count }),
    )
  }
  const capacity = monthlyCapacityHours()

  const demandRows = plan.before.map((m) => {
    const key = m.month.toISOString().slice(0, 7)
    const hours = hoursByMonth.get(key) ?? 0
    const after = plan.after.find((a) => a.month.getTime() === m.month.getTime())?.count ?? 0
    // Scale hours proportionally with the moved volume.
    const hoursAfter = m.count === 0 ? 0 : (hours / m.count) * after
    return {
      month: m.month,
      countBefore: m.count,
      countAfter: after,
      hours,
      hoursAfter,
      utilisation: hours / capacity,
      utilisationAfter: hoursAfter / capacity,
    }
  })

  const overloadedBefore = demandRows.filter((r) => r.utilisation > 1).length
  const overloadedAfter = demandRows.filter((r) => r.utilisationAfter > 1).length
  const peakUtil = Math.max(...demandRows.map((r) => r.utilisation), 0)

  // Which obligation types the optimizer was able to move.
  const movesByType = new Map<ObligationType, number>()
  for (const move of plan.moves) {
    movesByType.set(move.type, (movesByType.get(move.type) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        title="Planning"
        subtitle="Compliance volume arrives in waves. Much of it can legally be done early — this is what moving it does to the peak."
      />

      <div className="px-8 py-6">
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Peak month</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">{plan.peakBefore}</div>
            <div className="mt-1 text-[11px] text-ink-faint">filings, as scheduled</div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">
              Peak after pull-forward
            </div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-good">{plan.peakAfter}</div>
            <div className="mt-1 text-[11px] text-ink-faint">
              {(plan.reduction * 100).toFixed(0)}% lower
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Filings moved</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">
              {plan.moves.length}
            </div>
            <div className="mt-1 text-[11px] text-ink-faint">all within their legal window</div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">
              Months over capacity
            </div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">
              <span className={overloadedBefore > 0 ? 'text-critical' : ''}>
                {overloadedBefore}
              </span>
              <span className="text-ink-faint"> → </span>
              <span className={overloadedAfter > 0 ? 'text-high' : 'text-good'}>
                {overloadedAfter}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-ink-faint">estimated, see assumptions</div>
          </Card>
        </div>

        <Section
          title="Before and after"
          description="Grey is the schedule as it stands. Green is the same work with everything moved as early as its rules allow."
        >
          <Card className="px-5 py-5">
            <div className="flex items-end gap-2" style={{ height: 200 }}>
              {plan.before.map((m, i) => {
                const after = plan.after[i]
                const scale = plan.peakBefore || 1
                return (
                  <div key={String(m.month)} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="numeric text-[11px] text-ink-faint">
                      {m.count}
                      {after.count !== m.count && (
                        <span className={after.count < m.count ? 'text-good' : 'text-ink-soft'}>
                          {' '}
                          → {after.count}
                        </span>
                      )}
                    </div>
                    <div className="flex w-full max-w-[56px] items-end justify-center gap-0.5">
                      <div
                        className="w-1/2 rounded-t bg-edge-strong"
                        style={{ height: `${(m.count / scale) * 140}px` }}
                        title={`${monthLabel(m.month)}: ${m.count} as scheduled`}
                      />
                      <div
                        className="w-1/2 rounded-t"
                        style={{
                          height: `${(after.count / scale) * 140}px`,
                          backgroundColor: 'var(--color-good)',
                        }}
                        title={`${monthLabel(m.month)}: ${after.count} after pull-forward`}
                      />
                    </div>
                    <div className="text-[11px] text-ink-faint">{monthLabel(m.month)}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex gap-4 border-t border-edge pt-3.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-edge-strong" />
                <span className="text-[12px] text-ink-soft">As scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: 'var(--color-good)' }}
                />
                <span className="text-[12px] text-ink-soft">After pull-forward</span>
              </div>
            </div>
          </Card>
        </Section>

        <Section
          title="Capacity"
          description="Estimated hours of work per month against estimated hours available."
        >
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">Filings</Th>
                <Th className="text-right">Est. hours</Th>
                <Th className="text-right">Utilisation</Th>
                <Th className="text-right">After pull-forward</Th>
                <Th>Load</Th>
              </tr>
            </thead>
            <tbody>
              {demandRows.map((r) => (
                <tr key={String(r.month)} className="hover:bg-canvas">
                  <Td className="font-medium text-ink">{monthLabel(r.month)}</Td>
                  <Td className="numeric text-right text-ink-soft">
                    {r.countBefore}
                    {r.countAfter !== r.countBefore && (
                      <span className="text-good"> → {r.countAfter}</span>
                    )}
                  </Td>
                  <Td className="numeric text-right text-ink-soft">{Math.round(r.hours)}</Td>
                  <Td
                    className={`numeric text-right font-medium ${
                      r.utilisation > 1
                        ? 'text-critical'
                        : r.utilisation > 0.85
                          ? 'text-high'
                          : 'text-ink-soft'
                    }`}
                  >
                    {(r.utilisation * 100).toFixed(0)}%
                  </Td>
                  <Td
                    className={`numeric text-right font-medium ${
                      r.utilisationAfter > 1 ? 'text-high' : 'text-good'
                    }`}
                  >
                    {(r.utilisationAfter * 100).toFixed(0)}%
                  </Td>
                  <Td>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, r.utilisation * 100)}%`,
                          backgroundColor:
                            r.utilisation > 1
                              ? 'var(--color-critical)'
                              : r.utilisation > 0.85
                                ? 'var(--color-high)'
                                : 'var(--color-good)',
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title="What can move" description="Only work whose legal start window opens in an earlier, quieter month is eligible.">
          {plan.moves.length === 0 ? (
            <EmptyState message="No filings can be pulled forward in the current window." />
          ) : (
            <Card className="px-5 py-4">
              <ul className="space-y-2">
                {[...movesByType.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <li key={type} className="flex items-baseline justify-between gap-4">
                      <span className="text-[13px] text-ink">{OBLIGATION_LABELS[type]}</span>
                      <span className="numeric text-[13px] text-ink-soft">
                        {count} filing{count === 1 ? '' : 's'} movable
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </Section>

        {/* The assumptions are the weakest part of this page, so they are stated, not buried. */}
        <Section title="Assumptions behind the capacity model">
          <Card className="px-5 py-4">
            <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
              These are <span className="font-medium text-ink">estimates, not measurements</span>.
              Real handling times would come from time tracking; without that, the utilisation
              figures above should be read as a shape rather than a number.
            </p>
            <div className="grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
              <div className="flex justify-between border-b border-edge py-1">
                <span className="text-ink-soft">Staff on filings</span>
                <span className="numeric text-ink">{CAPACITY_ASSUMPTIONS.staffCount}</span>
              </div>
              <div className="flex justify-between border-b border-edge py-1">
                <span className="text-ink-soft">Productive hours per day</span>
                <span className="numeric text-ink">
                  {CAPACITY_ASSUMPTIONS.productiveHoursPerDay}
                </span>
              </div>
              <div className="flex justify-between border-b border-edge py-1">
                <span className="text-ink-soft">Working days per month</span>
                <span className="numeric text-ink">
                  {CAPACITY_ASSUMPTIONS.workingDaysPerMonth}
                </span>
              </div>
              <div className="flex justify-between border-b border-edge py-1">
                <span className="text-ink-soft">Monthly capacity</span>
                <span className="numeric text-ink">{capacity.toLocaleString()} hrs</span>
              </div>
              {Object.entries(CAPACITY_ASSUMPTIONS.hoursPerFiling).map(([type, hours]) => (
                <div key={type} className="flex justify-between border-b border-edge py-1">
                  <span className="text-ink-soft">
                    {OBLIGATION_LABELS[type as ObligationType]}
                  </span>
                  <span className="numeric text-ink">{hours} hrs</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
              Peak utilisation is currently {(peakUtil * 100).toFixed(0)}% of estimated capacity.
              Note also that this book is 40 carriers — at the real scale of 18,000, both the peak
              and the benefit of moving work off it scale with it.
            </p>
          </Card>
        </Section>
      </div>
    </>
  )
}
