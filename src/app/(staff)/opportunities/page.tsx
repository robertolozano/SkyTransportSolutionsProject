import Link from 'next/link'
import { getCoverageGaps } from '@/server/queries'
import { OBLIGATION_LABELS } from '@/rules'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'
import {
  EmptyState,
  PageHeader,
  Section,
  Stat,
  Table,
  Td,
  Th,
  TierBadge,
  money,
} from '@/components/ui'
import type { ObligationType } from '@/rules'

export const dynamic = 'force-dynamic'

/**
 * Coverage gaps.
 *
 * One query, two audiences. Sales reads it as a ranked upsell list. Operations reads
 * it as the record of which obligations sit outside what the client actually pays for
 * — which is the documentation that matters when something is missed.
 */
export default async function OpportunitiesPage() {
  const gaps = await getCoverageGaps()
  const totalUpgrade = gaps.reduce((sum, g) => sum + Number(g.upgradeValue), 0)
  const affectedTrucks = gaps.reduce((sum, g) => sum + g.truckCount, 0)

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle="Accounts carrying obligations their plan does not include. Each row is both an upsell and a liability disclosure."
      />

      <div className="px-8 py-6">
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Accounts with gaps" value={gaps.length} />
          <Stat label="Trucks affected" value={affectedTrucks} />
          <Stat
            label="Annual upgrade value"
            value={money(totalUpgrade)}
            hint="If every gap closed at Diamond"
            tone="good"
          />
          <Stat
            label="Diamond price"
            value={`${money(TIER_ANNUAL_PRICE.DIAMOND)}/truck`}
            hint={`vs ${money(TIER_ANNUAL_PRICE.SILVER)} Silver`}
          />
        </div>

        <Section
          title="Ranked by upgrade value"
          description="Fleet size multiplied by the per-truck difference between the current plan and Diamond."
        >
          {gaps.length === 0 ? (
            <EmptyState message="Every obligation in the book is covered by its client's plan." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Carrier</Th>
                  <Th>Current plan</Th>
                  <Th className="text-right">Trucks</Th>
                  <Th className="text-right">Uncovered</Th>
                  <Th>What is not covered</Th>
                  <Th className="text-right">Upgrade value</Th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.carrierId} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/clients/${g.dotNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {g.legalName}
                      </Link>
                      <div className="numeric mt-0.5 text-[11px] text-ink-faint">
                        DOT {g.dotNumber}
                      </div>
                    </Td>
                    <Td>
                      <TierBadge tier={g.tier} />
                    </Td>
                    <Td className="numeric text-right text-ink-soft">{g.truckCount}</Td>
                    <Td className="numeric text-right font-medium text-high">
                      {g.uncoveredCount}
                    </Td>
                    <Td className="text-[12px] leading-snug text-ink-soft">
                      {g.uncoveredTypes
                        .map((t) => OBLIGATION_LABELS[t as ObligationType] ?? t)
                        .join(', ')}
                    </Td>
                    <Td className="numeric text-right font-medium text-good">
                      {money(Number(g.upgradeValue))}
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
