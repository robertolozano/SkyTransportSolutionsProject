import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCarrierByDot, getFilingHistory } from '@/server/queries'
import { assessSubject } from '@/server/assess'
import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { riskLevel } from '@/rules/graph'
import { annualMembershipValue, requiredTierFor, TIER_ANNUAL_PRICE, upgradeValue } from '@/rules/pricing'
import {
  Card,
  Countdown,
  DateText,
  EmptyState,
  PageHeader,
  RiskPill,
  Section,
  Table,
  Td,
  Th,
  TierBadge,
  StatusPill,
  money,
  type Status,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function CarrierPage({ params }: { params: Promise<{ dot: string }> }) {
  const { dot } = await params
  const carrier = await getCarrierByDot(dot)
  if (!carrier) notFound()

  const asOf = new Date()
  const open = carrier.obligations.filter((o) => o.status !== 'COMPLETED')
  const assessment = assessSubject(carrier.obligations, asOf)
  const filings = await getFilingHistory(carrier.id)

  const activeTrucks = carrier.trucks.filter((t) => !t.retiredAt)
  const membership = annualMembershipValue(carrier.tier, activeTrucks.length)

  const uncovered = open.filter((o) => !o.coveredByTier)
  const uncoveredValue = upgradeValue(carrier.tier, 'DIAMOND', activeTrucks.length)

  // Per-truck out-of-service dates.
  const truckAssessments = activeTrucks.map((truck) => {
    const rows = carrier.obligations.filter((o) => o.truckId === truck.id)
    return { truck, assessment: assessSubject(rows, asOf) }
  })

  return (
    <>
      <PageHeader
        title={carrier.legalName}
        subtitle={
          <span className="numeric">
            DOT {carrier.dotNumber}
            {carrier.mcNumber ? ` · ${carrier.mcNumber}` : ''} · EIN {carrier.ein} · {carrier.city},{' '}
            {carrier.state} ·{' '}
            {carrier.operationType === 'INTERSTATE' ? 'Interstate' : 'Intrastate'}
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            <TierBadge tier={carrier.tier} />
            <span className="numeric text-[13px] text-ink-soft">{money(membership)}/yr</span>
          </div>
        }
      />

      <div className="px-8 py-6">
        {/* Headline: the date this account first loses a vehicle. */}
        <Card className="mb-8 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                First out-of-service date
              </div>
              {assessment.date ? (
                <>
                  <div className="numeric mt-1 flex items-baseline gap-3">
                    <span className="text-2xl font-semibold tracking-tight text-ink">
                      {formatDay(assessment.date)}
                    </span>
                    <Countdown days={assessment.daysRemaining} />
                    <RiskPill level={riskLevel(assessment.daysRemaining)} />
                  </div>
                  {assessment.rootCause && assessment.rootCause.id !== assessment.target?.id && (
                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
                      Root cause is{' '}
                      <span className="font-medium text-ink">
                        {OBLIGATION_LABELS[assessment.rootCause.type]}
                      </span>{' '}
                      due {formatDay(assessment.rootCause.dueOn)} — {' '}
                      {assessment.chain.length - 1} prerequisite
                      {assessment.chain.length - 1 === 1 ? '' : 's'} stand between today and the
                      deadline.
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-1 text-[13px] text-good">
                  Nothing service-critical outstanding.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6 text-right">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-faint">Open</div>
                <div className="numeric mt-1 text-lg font-semibold text-ink">{open.length}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-faint">Overdue</div>
                <div
                  className={`numeric mt-1 text-lg font-semibold ${
                    open.filter((o) => o.status === 'OVERDUE').length > 0 ? 'text-critical' : 'text-ink'
                  }`}
                >
                  {open.filter((o) => o.status === 'OVERDUE').length}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-faint">Outside plan</div>
                <div
                  className={`numeric mt-1 text-lg font-semibold ${
                    uncovered.length > 0 ? 'text-high' : 'text-ink'
                  }`}
                >
                  {uncovered.length}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {uncovered.length > 0 && (
          <div className="mb-8 rounded-lg border border-medium-edge bg-medium-soft px-5 py-4">
            <div className="text-[13px] font-semibold text-medium">
              {uncovered.length} obligations fall outside this client&apos;s{' '}
              {carrier.tier.toLowerCase()} plan
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {Array.from(new Set(uncovered.map((o) => OBLIGATION_LABELS[o.type]))).join(', ')}.
              Upgrading {activeTrucks.length} truck{activeTrucks.length === 1 ? '' : 's'} to Diamond
              covers all of it and is worth {money(uncoveredValue)} a year.
            </p>
          </div>
        )}

        <Section
          title="Fleet"
          description="Each vehicle's own out-of-service date, derived from its plate cycle and prerequisites."
        >
          {truckAssessments.length === 0 ? (
            <EmptyState message="No active vehicles." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Vehicle</Th>
                  <Th>VIN</Th>
                  <Th className="text-right">Weight</Th>
                  <Th>Out of service</Th>
                  <Th className="text-right">Left</Th>
                  <Th>Root cause</Th>
                </tr>
              </thead>
              <tbody>
                {truckAssessments.map(({ truck, assessment: a }) => (
                  <tr key={truck.id} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/trucks/${truck.vin}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {truck.unitNumber}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">
                      {truck.year} {truck.make}
                    </Td>
                    <Td className="numeric text-[11px] text-ink-faint">{truck.vin}</Td>
                    <Td className="numeric text-right text-ink-soft">
                      {truck.grossWeightLbs.toLocaleString()}
                    </Td>
                    <Td>
                      <DateText date={a.date} />
                    </Td>
                    <Td className="text-right">
                      <Countdown days={a.daysRemaining} />
                    </Td>
                    <Td className="text-ink-soft">
                      {a.rootCause ? (
                        <>
                          {OBLIGATION_LABELS[a.rootCause.type]}
                          <span className="ml-1.5 text-[11px] text-ink-faint">
                            {formatDay(a.rootCause.dueOn)}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>

        <Section
          title="Obligations"
          description="Every derived deadline for this account, with the rule that produced it."
        >
          <Table>
            <thead>
              <tr>
                <Th>Obligation</Th>
                <Th>Subject</Th>
                <Th>Period</Th>
                <Th>Due</Th>
                <Th className="text-right">Left</Th>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Authority</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {carrier.obligations.slice(0, 60).map((o) => (
                <tr key={o.id} className="hover:bg-canvas">
                  <Td className="text-ink">{OBLIGATION_LABELS[o.type]}</Td>
                  <Td className="text-ink-soft">
                    {o.truck ? (
                      <Link href={`/trucks/${o.truck.vin}`} className="hover:text-brand hover:underline">
                        Unit {o.truck.unitNumber}
                      </Link>
                    ) : o.driver ? (
                      `${o.driver.firstName} ${o.driver.lastName}`
                    ) : (
                      <span className="text-ink-faint">Carrier</span>
                    )}
                  </Td>
                  <Td className="text-ink-faint">{o.periodLabel}</Td>
                  <Td>
                    <DateText date={o.dueOn} />
                  </Td>
                  <Td className="text-right">
                    <Countdown
                      days={o.status === 'COMPLETED' ? null : daysBetween(asOf, o.dueOn)}
                    />
                  </Td>
                  <Td>
                    <StatusPill status={o.status as Status} />
                  </Td>
                  <Td>
                    {o.coveredByTier ? (
                      <span className="text-[11px] text-ink-faint">
                        {requiredTierFor(o.type).charAt(0)}
                        {requiredTierFor(o.type).slice(1).toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-critical">
                        Needs {requiredTierFor(o.type).toLowerCase()} (
                        {money(TIER_ANNUAL_PRICE[requiredTierFor(o.type)])})
                      </span>
                    )}
                  </Td>
                  <Td className="max-w-[240px] text-[11px] leading-snug text-ink-faint">
                    {o.citation}
                  </Td>
                  <Td>
                    {o.status !== 'COMPLETED' && (
                      <Link
                        href={`/packet/${o.id}`}
                        className="text-[12px] text-brand hover:underline"
                      >
                        Packet
                      </Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section
          title="Filing history"
          description="Every submission on record — what was sent, when, by whom, and the confirmation reference. Answers “did we actually file that?” without a portal search."
        >
          {filings.length === 0 ? (
            <EmptyState message="No filings recorded for this carrier yet." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Filed</Th>
                  <Th>Obligation</Th>
                  <Th>Subject</Th>
                  <Th>Period</Th>
                  <Th>Agency</Th>
                  <Th>Filed by</Th>
                  <Th>Confirmation</Th>
                  <Th className="text-right">Ahead of deadline</Th>
                </tr>
              </thead>
              <tbody>
                {filings.slice(0, 40).map((f) => (
                  <tr key={f.id} className="hover:bg-canvas">
                    <Td>
                      <DateText date={f.submittedAt} />
                    </Td>
                    <Td className="text-ink">{OBLIGATION_LABELS[f.obligation.type]}</Td>
                    <Td className="text-ink-soft">
                      {f.obligation.truck ? (
                        `Unit ${f.obligation.truck.unitNumber}`
                      ) : f.obligation.driver ? (
                        `${f.obligation.driver.firstName} ${f.obligation.driver.lastName}`
                      ) : (
                        <span className="text-ink-faint">Carrier</span>
                      )}
                    </Td>
                    <Td className="text-ink-faint">{f.obligation.periodLabel}</Td>
                    <Td className="text-ink-soft">{f.agency}</Td>
                    <Td className="numeric text-ink-soft">{f.submittedBy}</Td>
                    <Td className="numeric text-[11px] text-ink-faint">{f.confirmationRef}</Td>
                    <Td className="numeric text-right text-ink-soft">
                      {daysBetween(f.submittedAt, f.obligation.dueOn)}d
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
