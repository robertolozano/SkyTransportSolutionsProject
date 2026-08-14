import Link from 'next/link'
import { getCarrierRisk } from '@/server/queries'
import { riskLevel } from '@/rules/graph'
import {
  Countdown,
  DateText,
  EmptyState,
  PageHeader,
  RiskPill,
  Table,
  Td,
  Th,
  TierBadge,
  money,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const carriers = await getCarrierRisk()
  const prospects = carriers.filter((c) => c.status === 'PROSPECT')
  const active = carriers.filter((c) => c.status !== 'PROSPECT')
  const exposed = active.filter(
    (c) => c.daysToOutOfService !== null && c.daysToOutOfService <= 30,
  ).length

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${active.length} active carriers, sorted by the date their first vehicle stops being legal — ${exposed} within 30 days.${
          prospects.length > 0
            ? ` ${prospects.length} new ${prospects.length === 1 ? 'lead' : 'leads'} awaiting callback.`
            : ''
        }`}
      />

      <div className="px-8 py-6">
        {carriers.length === 0 ? (
          <EmptyState message="No carriers in the book." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Carrier</Th>
                <Th>Location</Th>
                <Th className="text-right">Trucks</Th>
                <Th>Plan</Th>
                <Th className="text-right">Open</Th>
                <Th className="text-right">Overdue</Th>
                <Th>Out of service</Th>
                <Th className="text-right">Left</Th>
                <Th>Risk</Th>
                <Th className="text-right">Membership</Th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((c) => (
                <tr key={c.id} className="hover:bg-canvas">
                  <Td>
                    <Link
                      href={`/clients/${c.dotNumber}`}
                      className="font-medium text-ink hover:text-brand hover:underline"
                    >
                      {c.legalName}
                    </Link>
                    <div className="numeric mt-0.5 text-[11px] text-ink-faint">
                      {c.dotNumber.startsWith('PENDING-')
                        ? 'USDOT not yet issued'
                        : `DOT ${c.dotNumber}`}{' '}
                      · {c.operationType === 'INTERSTATE' ? 'Interstate' : 'Intrastate'}
                    </div>
                    {c.status === 'PROSPECT' && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-medium-edge bg-medium-soft px-1.5 py-0.5 text-[10px] font-medium text-medium">
                          New lead
                        </span>
                        {c.contactName && (
                          <span className="text-[11px] text-ink-faint">{c.contactName}</span>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="text-ink-soft">
                    {c.city ? `${c.city}, ${c.state}` : c.state}
                  </Td>
                  <Td className="numeric text-right text-ink-soft">{c.truckCount}</Td>
                  <Td>
                    <TierBadge tier={c.tier} />
                  </Td>
                  <Td className="numeric text-right text-ink-soft">{c.openCount}</Td>
                  <Td className="numeric text-right">
                    {c.overdueCount > 0 ? (
                      <span className="font-medium text-critical">{c.overdueCount}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <DateText date={c.outOfServiceOn} />
                  </Td>
                  <Td className="text-right">
                    <Countdown days={c.daysToOutOfService} />
                  </Td>
                  <Td>
                    <RiskPill level={riskLevel(c.daysToOutOfService)} />
                  </Td>
                  <Td className="numeric text-right text-ink-soft">{money(c.revenueAtRisk)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  )
}
