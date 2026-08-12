import { toUtcDay, utc, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'

/**
 * Unified Carrier Registration.
 *
 * Annual federal fee, bracketed by fleet size. Registration for the coming year
 * opens October 1 and is due by December 31 — which is the other half of the
 * seasonal wave, landing on every interstate client at once.
 */
export function ucrRegistrationYearFor(asOf: Date): number {
  const today = toUtcDay(asOf)
  // From October onward, the open registration period is for the FOLLOWING year.
  return today.getUTCMonth() >= 9 ? today.getUTCFullYear() + 1 : today.getUTCFullYear()
}

export const ucrRule: Rule = {
  id: 'ucr-annual-registration',
  name: 'UCR Annual Registration',
  obligationType: 'UCR_RENEWAL',
  scope: 'CARRIER',
  summary:
    'Interstate motor carriers, brokers, and freight forwarders must register annually under the Unified Carrier Registration Agreement and pay a fee bracketed by fleet size.',
  derivation:
    'Registration for the upcoming year opens October 1 and is due by December 31 of the preceding year. The obligation is projected for whichever registration year is currently open.',
  citation: '49 CFR Part 367 — Unified Carrier Registration fees and schedule',
  citationDetail: {
    agency: 'FMCSA / UCR Plan',
    authority: '49 CFR Part 367',
    form: 'UCR annual registration',
    url: 'https://www.ucr.gov/',
  },
  verification: {
    status: 'VERIFIED_AGAINST_SOURCE',
    note:
      'October 1 opening and December 31 deadline are stable year to year. Enforcement tolerance in the early weeks of January varies by state and is not modelled. Fee brackets are not implemented — this rule produces the deadline only, not the amount.',
  },
  gates: [],
  coveredFromTier: 'GOLD',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    if (carrier.operationType !== 'INTERSTATE') return []

    const out: DerivedObligation[] = []
    const currentYear = ucrRegistrationYearFor(ctx.asOf)

    for (const registrationYear of [currentYear, currentYear + 1]) {
      const dueOn = utc(registrationYear - 1, 12, 31)
      const opensOn = utc(registrationYear - 1, 10, 1)
      if (!withinHorizon(dueOn, ctx.asOf, ctx.horizonDays)) continue

      out.push({
        ruleId: ucrRule.id,
        type: 'UCR_RENEWAL',
        carrierId: carrier.id,
        periodLabel: `${registrationYear} registration year`,
        dueOn,
        earliestStart: opensOn,
        citation: ucrRule.citation,
        coveredByTier: tierCovers(carrier.tier, ucrRule.coveredFromTier),
      })
    }
    return out
  },
}
