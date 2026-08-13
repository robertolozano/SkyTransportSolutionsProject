import { RULES, gateEdges, OBLIGATION_LABELS } from '@/rules'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'
import { PageHeader, Section, Card, money } from '@/components/ui'

/**
 * The rules library.
 *
 * Reads its content directly from the exported rule metadata, so this page cannot
 * drift from the engine that actually computes the dates. It also states plainly
 * which rules are verified and which still need review — a compliance tool that
 * hides its own uncertainty is worse than one that admits it.
 */
export default function RulesPage() {
  const edges = gateEdges()
  const needsReview = RULES.filter((r) => r.verification.status === 'NEEDS_REVIEW')

  return (
    <>
      <PageHeader
        title="Rules"
        subtitle="Every deadline in this system is derived by one of these rules. Each carries the authority it came from and an explicit statement of how far it has been verified."
      />

      <div className="px-8 py-6">
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Rules encoded</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">{RULES.length}</div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">
              Verified against source
            </div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-good">
              {RULES.length - needsReview.length}
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Needs review</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-medium">
              {needsReview.length}
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">
              Dependency gates
            </div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">{edges.length}</div>
          </Card>
        </div>

        <Section
          title="Dependency gates"
          description="Where one filing is a precondition for another. These edges are declared on the rules themselves and projected into the database, so the graph and the engine cannot disagree."
        >
          <div className="space-y-2">
            {edges.map((e) => (
              <Card key={`${e.blockerType}-${e.blockedType}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink">
                    {OBLIGATION_LABELS[e.blockerType]}
                  </span>
                  <span className="text-ink-faint" aria-hidden>
                    →
                  </span>
                  <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-ink">
                    {OBLIGATION_LABELS[e.blockedType]}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{e.reason}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Encoded rules">
          <div className="space-y-3">
            {RULES.map((rule) => {
              const verified = rule.verification.status === 'VERIFIED_AGAINST_SOURCE'
              return (
                <Card key={rule.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge px-5 py-3.5">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-ink">{rule.name}</h3>
                      <div className="numeric mt-0.5 text-[11px] text-ink-faint">{rule.id}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] text-ink-soft">
                        per {rule.scope.toLowerCase()}
                      </span>
                      <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] text-ink-soft">
                        {rule.coveredFromTier.charAt(0)}
                        {rule.coveredFromTier.slice(1).toLowerCase()} (
                        {money(TIER_ANNUAL_PRICE[rule.coveredFromTier])})
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                          verified
                            ? 'border-good-edge bg-good-soft text-good'
                            : 'border-medium-edge bg-medium-soft text-medium'
                        }`}
                      >
                        {verified ? 'Verified' : 'Needs review'}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        What it is
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                        {rule.summary}
                      </p>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        How the date is derived
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                        {rule.derivation}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 border-t border-edge bg-canvas px-5 py-4 lg:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        Authority
                      </div>
                      <div className="mt-1.5 text-[13px] text-ink">
                        {rule.citationDetail.agency} — {rule.citationDetail.authority}
                      </div>
                      {rule.citationDetail.form && (
                        <div className="mt-0.5 text-[13px] text-ink-soft">
                          {rule.citationDetail.form}
                        </div>
                      )}
                      <a
                        href={rule.citationDetail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block break-all text-[11px] text-brand hover:underline"
                      >
                        {rule.citationDetail.url}
                      </a>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        Verification note
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                        {rule.verification.note}
                      </p>
                    </div>
                  </div>

                  {rule.gates.length > 0 && (
                    <div className="border-t border-edge px-5 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        Gates
                      </span>{' '}
                      <span className="text-[13px] text-ink-soft">
                        {rule.gates.map((g) => OBLIGATION_LABELS[g]).join(', ')}
                      </span>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </Section>

        <Section title="What is not implemented">
          <Card className="px-5 py-4">
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <span className="font-medium text-ink">Holiday calendars.</span> Weekend rollover is
                implemented; per-jurisdiction holiday tables are not, so a deadline landing on a
                state holiday may be shown a day or two early.
              </li>
              <li>
                <span className="font-medium text-ink">Fee calculation.</span> Every rule produces a
                deadline, none produce an amount owed. Fuel tax apportionment and fleet-size fee
                brackets are out of scope.
              </li>
              <li>
                <span className="font-medium text-ink">Jurisdiction-specific plate staggering.</span>{' '}
                Plate expiry is read from the record rather than derived from each base state&apos;s
                schedule.
              </li>
              <li>
                <span className="font-medium text-ink">Partial-period proration.</span> Heavy vehicle
                tax for a vehicle first used mid-year is not prorated.
              </li>
            </ul>
          </Card>
        </Section>
      </div>
    </>
  )
}
