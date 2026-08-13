import Link from 'next/link'
import { getOutstandingRequests, getRequestSummary } from '@/server/queries'
import { chaseState, CHASE_LADDER, REQUEST_LEAD_DAYS } from '@/rules/chase'
import { daysBetween } from '@/rules/dates'
import {
  Card,
  Countdown,
  DateText,
  EmptyState,
  PageHeader,
  Section,
  Stat,
  Table,
  Td,
  Th,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const ACTION_STYLES: Record<string, string> = {
  WAIT: 'bg-canvas text-ink-soft border-edge-strong',
  FIRST_REMINDER: 'bg-brand-soft text-brand border-indigo-200',
  SECOND_REMINDER: 'bg-medium-soft text-medium border-medium-edge',
  STAFF_CALL: 'bg-high-soft text-high border-high-edge',
  ESCALATE: 'bg-critical-soft text-critical border-critical-edge',
}

/**
 * Document collection.
 *
 * Two features on one screen because they are two halves of one loop: requests go
 * out automatically ahead of expiry, and unanswered ones climb a fixed escalation
 * ladder. The point is that neither depends on a person remembering.
 */
export default async function RequestsPage() {
  const [requests, summary] = await Promise.all([getOutstandingRequests(), getRequestSummary()])
  const asOf = new Date()

  const withState = requests.map((doc) => ({
    doc,
    state: chaseState(doc.requestedAt ?? asOf, asOf),
  }))

  // Anything needing a human right now.
  const needsStaff = withState.filter(
    (r) => r.state.action === 'STAFF_CALL' || r.state.action === 'ESCALATE',
  )

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={`Replacement documents are requested ${REQUEST_LEAD_DAYS} days before the credential expires, then chased on a fixed ladder until they arrive.`}
      />

      <div className="px-8 py-6">
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Outstanding"
            value={summary.outstanding}
            hint="Requested, not yet received"
            tone={summary.outstanding > 0 ? 'high' : 'good'}
          />
          <Stat
            label="Needs a person"
            value={needsStaff.length}
            hint="Automated channels exhausted"
            tone={needsStaff.length > 0 ? 'critical' : 'good'}
          />
          <Stat label="Received" value={summary.received} hint="Filed against a credential" tone="good" />
          <Stat
            label="Median return time"
            value={
              summary.medianDaysToReturn === null
                ? '—'
                : `${Number(summary.medianDaysToReturn).toFixed(1)}d`
            }
            hint="Request sent to document in hand"
          />
        </div>

        {summary.expiringUnrequested > 0 && (
          <div className="mb-8 rounded-lg border border-high-edge bg-high-soft px-5 py-4">
            <div className="text-[13px] font-semibold text-high">
              {summary.expiringUnrequested} expiring credentials have no request out
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              These fall inside the {REQUEST_LEAD_DAYS}-day window but no document has been asked
              for. In a deployed system the scheduled job closes this gap nightly; here it runs
              when the request generator is invoked.
            </p>
          </div>
        )}

        <Section
          title="Outstanding requests"
          description="Sorted by how soon the underlying credential expires, not by when the request went out."
        >
          {withState.length === 0 ? (
            <EmptyState message="No outstanding document requests." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Carrier</Th>
                  <Th>Subject</Th>
                  <Th>Document</Th>
                  <Th>Requested</Th>
                  <Th className="text-right">Waiting</Th>
                  <Th>Next action</Th>
                  <Th>Credential expires</Th>
                  <Th className="text-right">Left</Th>
                </tr>
              </thead>
              <tbody>
                {withState.map(({ doc, state }) => (
                  <tr key={doc.id} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/clients/${doc.carrier.dotNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {doc.carrier.legalName}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">
                      {doc.credential?.truck ? (
                        <Link
                          href={`/trucks/${doc.credential.truck.vin}`}
                          className="hover:text-brand hover:underline"
                        >
                          Unit {doc.credential.truck.unitNumber}
                        </Link>
                      ) : doc.credential?.driver ? (
                        `${doc.credential.driver.firstName} ${doc.credential.driver.lastName}`
                      ) : (
                        <span className="text-ink-faint">Carrier</span>
                      )}
                    </Td>
                    <Td className="text-ink">{doc.type}</Td>
                    <Td>
                      <DateText date={doc.requestedAt} />
                    </Td>
                    <Td className="numeric text-right text-ink-soft">
                      {state.daysSinceRequest}d
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                          ACTION_STYLES[state.action] ?? ACTION_STYLES.WAIT
                        }`}
                      >
                        {state.step?.label ?? 'Sent, waiting'}
                      </span>
                      {state.next && (
                        <div className="mt-0.5 text-[11px] text-ink-faint">
                          then {state.next.label.toLowerCase()} in {state.daysUntilNext}d
                        </div>
                      )}
                    </Td>
                    <Td>
                      <DateText date={doc.expiresOn} />
                    </Td>
                    <Td className="text-right">
                      <Countdown
                        days={doc.expiresOn ? daysBetween(asOf, doc.expiresOn) : null}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>

        <Section
          title="The ladder"
          description="Fixed sequence, applied identically to every request. Cheap channels first — the client is driving, so a text lands and a phone call does not."
        >
          <Card className="px-5 py-4">
            <ol className="space-y-3">
              {CHASE_LADDER.map((step, i) => {
                const atThisStep = withState.filter((r) => r.state.action === step.action).length
                return (
                  <li key={step.action} className="flex items-start gap-3">
                    <span className="numeric mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-medium text-ink-soft">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">
                          Day {step.atDay} — {step.label}
                        </span>
                        <span className="text-[11px] text-ink-faint">
                          {atThisStep} request{atThisStep === 1 ? '' : 's'} here now
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 border-t border-edge pt-3 text-[13px] leading-relaxed text-ink-faint">
              Sending the messages is not implemented — there is no SMS provider wired up. The
              ladder computes what should be sent and when; the delivery step is the roadmap item.
            </p>
          </Card>
        </Section>
      </div>
    </>
  )
}
