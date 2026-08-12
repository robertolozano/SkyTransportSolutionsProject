import Link from 'next/link'
import { getBookSummary, getWorkQueue, getLastRecompute } from '@/server/queries'
import { OBLIGATION_LABELS } from '@/rules'
import { ESTIMATED_DAILY_REVENUE_PER_TRUCK } from '@/rules/pricing'
import {
  Countdown,
  DateText,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  StatusPill,
  Table,
  Td,
  Th,
  TierBadge,
  money,
  type Status,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [summary, queue, lastRun] = await Promise.all([
    getBookSummary(),
    getWorkQueue(40),
    getLastRecompute(),
  ])

  const parkedCost = summary.trucksAtRisk * ESTIMATED_DAILY_REVENUE_PER_TRUCK

  return (
    <>
      <PageHeader
        title="Today"
        subtitle="Every open obligation across the book, ranked by how soon it fails and what it is holding up."
        right={
          lastRun && (
            <div className="text-right text-[11px] text-ink-faint">
              <div>Last recomputed</div>
              <div className="numeric">
                {lastRun.startedAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC
              </div>
            </div>
          )
        }
      />

      <div className="px-8 py-6">
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Trucks at risk"
            value={summary.trucksAtRisk}
            hint="Plate renewal inside 30 days"
            tone={summary.trucksAtRisk > 0 ? 'critical' : 'good'}
          />
          <Stat
            label="Overdue"
            value={summary.overdue}
            hint="Past the filing deadline"
            tone={summary.overdue > 0 ? 'critical' : 'good'}
            href="/deadlines?status=OVERDUE"
          />
          <Stat
            label="Due within 30 days"
            value={summary.dueSoon}
            hint="Actionable this month"
            tone="high"
            href="/deadlines?status=DUE"
          />
          <Stat
            label="Membership at risk"
            value={money(summary.revenueAtRisk)}
            hint="Annual value of accounts with a deadline inside 30 days"
          />
          <Stat
            label="Outside plan"
            value={summary.uncoveredObligations}
            hint="Obligations the client's tier does not cover"
            href="/opportunities"
          />
        </div>

        {summary.trucksAtRisk > 0 && (
          <div className="mb-8 rounded-lg border border-critical-edge bg-critical-soft px-5 py-4">
            <div className="text-[13px] font-semibold text-critical">
              {summary.trucksAtRisk} {summary.trucksAtRisk === 1 ? 'truck is' : 'trucks are'} on
              track to go out of service within 30 days.
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              At an estimated {money(ESTIMATED_DAILY_REVENUE_PER_TRUCK)} of revenue per truck per
              day, that is roughly {money(parkedCost)} of client revenue lost for every day those
              vehicles sit — against annual memberships of $199–$399. The cost of one miss is not
              symmetric with the fee for preventing it.
            </p>
          </div>
        )}

        <Section
          title="Work queue"
          description="Sorted by days remaining, then by how many downstream filings each item is blocking."
          right={
            <Link href="/deadlines" className="text-[13px] text-brand hover:underline">
              View all deadlines →
            </Link>
          }
        >
          {queue.length === 0 ? (
            <EmptyState message="Nothing outstanding in the next 120 days." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Carrier</Th>
                  <Th>Subject</Th>
                  <Th>Obligation</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Left</Th>
                  <Th>Status</Th>
                  <Th>Blocking</Th>
                  <Th>Plan</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.obligationId} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/clients/${row.dotNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {row.legalName}
                      </Link>
                      <div className="numeric mt-0.5 text-[11px] text-ink-faint">
                        DOT {row.dotNumber}
                      </div>
                    </Td>
                    <Td className="text-ink-soft">
                      {row.vin ? (
                        <Link href={`/trucks/${row.vin}`} className="hover:text-brand hover:underline">
                          Unit {row.unitNumber}
                        </Link>
                      ) : row.driverName ? (
                        row.driverName
                      ) : (
                        <span className="text-ink-faint">Carrier</span>
                      )}
                    </Td>
                    <Td>
                      <div className="text-ink">{OBLIGATION_LABELS[row.type]}</div>
                      <div className="text-[11px] text-ink-faint">{row.periodLabel}</div>
                    </Td>
                    <Td>
                      <DateText date={row.dueOn} />
                    </Td>
                    <Td className="text-right">
                      <Countdown days={row.daysLeft} />
                    </Td>
                    <Td>
                      <StatusPill status={row.status as Status} />
                    </Td>
                    <Td>
                      {row.blockingCount > 0 ? (
                        <span className="text-[11px] font-medium text-high">
                          {row.blockingCount} downstream
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      {row.coveredByTier ? (
                        <TierBadge tier={row.tier} />
                      ) : (
                        <span className="text-[11px] font-medium text-critical">Not covered</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      </div>
    </>
  )
}
