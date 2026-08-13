import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTruckByVin } from '@/server/queries'
import { assessSubject } from '@/server/assess'
import { WhatIfChain, type WireObligation } from '@/components/WhatIfChain'
import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { riskLevel } from '@/rules/graph'
import { backwardSchedule } from '@/rules/schedule'
import { ESTIMATED_DAILY_REVENUE_PER_TRUCK } from '@/rules/pricing'
import {
  Card,
  Countdown,
  DateText,
  PageHeader,
  RiskPill,
  Section,
  StatusPill,
  Table,
  Td,
  Th,
  money,
  type Status,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const CREDENTIAL_LABELS: Record<string, string> = {
  IRP_PLATE: 'Apportioned plate',
  HVUT_RECEIPT: 'Heavy vehicle tax receipt (Schedule 1)',
  EMISSIONS_CERT: 'Emissions certificate',
}

export default async function TruckPage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params
  const truck = await getTruckByVin(vin)
  if (!truck) notFound()

  const asOf = new Date()
  const assessment = assessSubject(truck.obligations, asOf)
  const open = truck.obligations.filter((o) => o.status !== 'COMPLETED')

  // Turn the chain into dated work: a due date is not a start date.
  const earliestStarts = new Map(truck.obligations.map((o) => [o.id, o.earliestStart]))
  const plan = backwardSchedule(assessment.chain, asOf, earliestStarts)

  const wire: WireObligation[] = truck.obligations.map((o) => ({
    id: o.id,
    type: o.type,
    carrierId: o.carrierId,
    truckId: o.truckId,
    driverId: o.driverId,
    periodLabel: o.periodLabel,
    dueOn: o.dueOn.toISOString(),
    completedAt: o.completedAt ? o.completedAt.toISOString() : null,
    citation: o.citation,
  }))

  return (
    <>
      <PageHeader
        title={`Unit ${truck.unitNumber} — ${truck.year} ${truck.make}`}
        subtitle={
          <span className="numeric">
            VIN {truck.vin} · {truck.grossWeightLbs.toLocaleString()} lbs · plated{' '}
            {truck.plateState}
          </span>
        }
        right={
          <Link
            href={`/clients/${truck.carrier.dotNumber}`}
            className="text-[13px] text-brand hover:underline"
          >
            {truck.carrier.legalName} →
          </Link>
        }
      />

      <div className="px-8 py-6">
        {/* The signature number. */}
        <Card className="mb-6 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Out of service on
              </div>
              {assessment.date ? (
                <>
                  <div className="numeric mt-1.5 flex flex-wrap items-baseline gap-3">
                    <span className="text-3xl font-semibold tracking-tight text-ink">
                      {formatDay(assessment.date)}
                    </span>
                    <Countdown days={assessment.daysRemaining} />
                    <RiskPill level={riskLevel(assessment.daysRemaining)} />
                  </div>

                  {assessment.chain.length > 1 && assessment.rootCause && (
                    <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
                      This date is not itself the problem. The binding constraint is{' '}
                      <span className="font-medium text-ink">
                        {OBLIGATION_LABELS[assessment.rootCause.type]}
                      </span>
                      , due {formatDay(assessment.rootCause.dueOn)} —{' '}
                      {daysBetween(asOf, assessment.rootCause.dueOn)} days out. Miss it and the
                      renewal behind it cannot complete, whatever the calendar says.
                    </p>
                  )}
                </>
              ) : (
                <div className="mt-2 text-[15px] text-good">
                  No service-critical obligation outstanding.
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">
                Cost if parked
              </div>
              <div className="numeric mt-1 text-lg font-semibold text-ink">
                {money(ESTIMATED_DAILY_REVENUE_PER_TRUCK)}
                <span className="text-[13px] font-normal text-ink-faint">/day</span>
              </div>
              <div className="mt-2 text-[11px] leading-snug text-ink-faint">
                Est. lost revenue
                <br />
                for this vehicle
              </div>
            </div>
          </div>
        </Card>

        <div className="mb-8">
          <WhatIfChain obligations={wire} asOfIso={asOf.toISOString()} />
        </div>

        {plan.steps.length > 0 && (
          <Section
            title="Action plan"
            description="Working backwards from the deadline through handling time and prerequisites. Each step must clear before the next one can start."
          >
            {plan.hasLateStep && (
              <div className="mb-3 rounded-lg border border-critical-edge bg-critical-soft px-4 py-3">
                <div className="text-[13px] font-semibold text-critical">
                  Behind schedule — work should already have started.
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  The start-by dates below account for handling time and a {''}
                  five-day buffer. A step marked late is not yet impossible, but the buffer is
                  gone.
                </p>
              </div>
            )}
            <Table>
              <thead>
                <tr>
                  <Th>Step</Th>
                  <Th>Obligation</Th>
                  <Th>Start by</Th>
                  <Th className="text-right">Days</Th>
                  <Th className="text-right">Handling</Th>
                  <Th>Earliest legal start</Th>
                  <Th>Due</Th>
                </tr>
              </thead>
              <tbody>
                {plan.steps.map((step, i) => (
                  <tr key={step.obligation.id} className="hover:bg-canvas">
                    <Td className="numeric text-ink-faint">{i + 1}</Td>
                    <Td className="text-ink">{OBLIGATION_LABELS[step.obligation.type]}</Td>
                    <Td>
                      <span
                        className={`numeric text-[13px] font-medium ${
                          step.late ? 'text-critical' : 'text-ink'
                        }`}
                      >
                        {formatDay(step.startBy)}
                      </span>
                      {step.impossible && (
                        <span className="ml-2 text-[11px] font-medium text-critical">
                          before window opens
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Countdown days={daysBetween(asOf, step.startBy)} />
                    </Td>
                    <Td className="numeric text-right text-ink-soft">{step.handlingDays}d</Td>
                    <Td>
                      <DateText date={step.earliestStart} />
                    </Td>
                    <Td>
                      <DateText date={step.obligation.dueOn} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
        )}

        <Section title="Credentials held">
          <Table>
            <thead>
              <tr>
                <Th>Credential</Th>
                <Th>Identifier</Th>
                <Th>Issued</Th>
                <Th>Expires</Th>
                <Th className="text-right">Left</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {truck.credentials.map((c) => (
                <tr key={c.id} className="hover:bg-canvas">
                  <Td className="text-ink">{CREDENTIAL_LABELS[c.type] ?? c.type}</Td>
                  <Td className="numeric text-ink-soft">{c.identifier ?? '—'}</Td>
                  <Td>
                    <DateText date={c.issuedOn} />
                  </Td>
                  <Td>
                    <DateText date={c.expiresOn} />
                  </Td>
                  <Td className="text-right">
                    <Countdown days={c.expiresOn ? daysBetween(asOf, c.expiresOn) : null} />
                  </Td>
                  <Td className="text-[11px] text-ink-soft">{c.status}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section
          title="Obligations"
          description={`${open.length} open, ${truck.obligations.length - open.length} filed.`}
        >
          <Table>
            <thead>
              <tr>
                <Th>Obligation</Th>
                <Th>Period</Th>
                <Th>Earliest start</Th>
                <Th>Due</Th>
                <Th className="text-right">Left</Th>
                <Th>Status</Th>
                <Th>Blocked by</Th>
              </tr>
            </thead>
            <tbody>
              {truck.obligations.map((o) => {
                const unmetBlockers = o.blockedBy.filter((b) => !b.blocker.completedAt)
                return (
                  <tr key={o.id} className="hover:bg-canvas">
                    <Td className="text-ink">{OBLIGATION_LABELS[o.type]}</Td>
                    <Td className="text-ink-faint">{o.periodLabel}</Td>
                    <Td>
                      <DateText date={o.earliestStart} />
                    </Td>
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
                    <Td className="text-[11px] text-ink-soft">
                      {unmetBlockers.length === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        unmetBlockers
                          .map((b) => OBLIGATION_LABELS[b.blocker.type])
                          .join(', ')
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Section>
      </div>
    </>
  )
}
