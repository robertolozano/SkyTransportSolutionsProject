import { lastDayOfMonth, toUtcDay, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'

/**
 * MCS-150 biennial update.
 *
 * This is the rule that best demonstrates the core problem: the carrier is never
 * told when this is due. The deadline is encoded in their own USDOT number.
 *
 *   last digit          -> month   (1 = January ... 9 = September, 0 = October)
 *   second-to-last digit-> parity  (odd = odd-numbered years, even = even-numbered years)
 *
 * Note that November and December are unreachable by design — the schedule only
 * uses ten months.
 */
export function mcs150DueMonth(dotNumber: string): number {
  const last = Number(dotNumber[dotNumber.length - 1])
  return last === 0 ? 10 : last
}

export function mcs150YearParity(dotNumber: string): 0 | 1 {
  const secondLast = Number(dotNumber[dotNumber.length - 2] ?? '0')
  return (secondLast % 2) as 0 | 1
}

/** The first MCS-150 deadline falling on or after `asOf`. */
export function nextMcs150Due(dotNumber: string, asOf: Date): Date {
  const month = mcs150DueMonth(dotNumber)
  const parity = mcs150YearParity(dotNumber)
  const today = toUtcDay(asOf)

  let year = today.getUTCFullYear()
  // Walk forward to the next year matching the required parity whose deadline
  // has not already passed. At most three iterations.
  for (let i = 0; i < 4; i++) {
    if (year % 2 === parity) {
      const due = lastDayOfMonth(year, month)
      if (due.getTime() >= today.getTime()) return due
    }
    year += 1
  }
  return lastDayOfMonth(year, month)
}

export const mcs150Rule: Rule = {
  id: 'mcs150-biennial-update',
  name: 'MCS-150 Biennial Update',
  obligationType: 'MCS150_BIENNIAL_UPDATE',
  scope: 'CARRIER',
  summary:
    'Every motor carrier must refile the MCS-150 form every two years to keep its USDOT registration current. Failure to update results in deactivation of the USDOT number.',
  derivation:
    'The deadline is derived from the USDOT number itself. The last digit selects the month (1 = January through 9 = September, 0 = October). The second-to-last digit selects the year parity: odd digits fall in odd-numbered years, even digits in even-numbered years. The filing is due by the last day of that month.',
  citation: '49 CFR 390.19(b) — FMCSA biennial update schedule',
  citationDetail: {
    agency: 'FMCSA',
    authority: '49 CFR 390.19(b)',
    form: 'MCS-150',
    url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-390/subpart-B/section-390.19',
  },
  verification: {
    status: 'VERIFIED_AGAINST_SOURCE',
    note: 'Digit-to-month mapping and year parity confirmed against the FMCSA published schedule. Note that months 11 and 12 are never used.',
  },
  gates: [],
  coveredFromTier: 'SILVER',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    const due = nextMcs150Due(carrier.dotNumber, ctx.asOf)
    if (!withinHorizon(due, ctx.asOf, ctx.horizonDays)) return []

    return [
      {
        ruleId: mcs150Rule.id,
        type: 'MCS150_BIENNIAL_UPDATE',
        carrierId: carrier.id,
        periodLabel: String(due.getUTCFullYear()),
        dueOn: due,
        earliestStart: null,
        citation: mcs150Rule.citation,
        coveredByTier: tierCovers(carrier.tier, mcs150Rule.coveredFromTier),
      },
    ]
  },
}
