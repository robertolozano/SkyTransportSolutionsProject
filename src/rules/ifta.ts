import { addDays, lastDayOfMonth, nextBusinessDay, toUtcDay, utc, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'

/**
 * IFTA quarterly fuel tax return.
 *
 * Fixed calendar: the return is due the last day of the month following the close
 * of each quarter. Unlike MCS-150 the date is not carrier-specific, which is exactly
 * why it produces the seasonal wave — every interstate client hits the same four
 * dates simultaneously.
 */
export interface IftaQuarter {
  label: string
  quarterStart: Date
  quarterEnd: Date
  dueOn: Date
}

export function iftaQuarter(year: number, quarter: 1 | 2 | 3 | 4): IftaQuarter {
  const startMonth = (quarter - 1) * 3 + 1
  const quarterStart = utc(year, startMonth, 1)
  const quarterEnd = lastDayOfMonth(year, startMonth + 2)

  // Due the last day of the month following quarter close; Q4 rolls into next year.
  const dueMonth = startMonth + 3
  const dueYear = dueMonth > 12 ? year + 1 : year
  const normalisedMonth = dueMonth > 12 ? dueMonth - 12 : dueMonth
  const rawDue = lastDayOfMonth(dueYear, normalisedMonth)

  return {
    label: `${year} Q${quarter}`,
    quarterStart,
    quarterEnd,
    dueOn: nextBusinessDay(rawDue),
  }
}

/** Every IFTA quarter whose due date falls inside the projection window. */
export function iftaQuartersInWindow(asOf: Date, horizonDays: number): IftaQuarter[] {
  const today = toUtcDay(asOf)
  const out: IftaQuarter[] = []
  for (let year = today.getUTCFullYear() - 1; year <= today.getUTCFullYear() + 2; year++) {
    for (const q of [1, 2, 3, 4] as const) {
      const quarter = iftaQuarter(year, q)
      if (withinHorizon(quarter.dueOn, asOf, horizonDays)) out.push(quarter)
    }
  }
  return out.sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime())
}

export const iftaRule: Rule = {
  id: 'ifta-quarterly-return',
  name: 'IFTA Quarterly Fuel Tax Return',
  obligationType: 'IFTA_QUARTERLY_RETURN',
  scope: 'CARRIER',
  summary:
    'Interstate carriers file one fuel tax return per quarter with their base jurisdiction, reporting miles driven and fuel purchased in each member jurisdiction. The base state then redistributes the tax.',
  derivation:
    'Due the last day of the month following the close of each quarter: April 30, July 31, October 31, and January 31. A due date landing on a weekend rolls to the next business day.',
  citation: 'IFTA Articles of Agreement R970 — quarterly tax return due dates',
  citationDetail: {
    agency: 'International Fuel Tax Association',
    authority: 'IFTA Articles of Agreement, Article R970',
    form: 'Quarterly Fuel Use Tax Return',
    url: 'https://www.iftach.org/',
  },
  verification: {
    status: 'VERIFIED_AGAINST_SOURCE',
    note: 'Quarter-end and due-date mapping is fixed and uniform across member jurisdictions. Weekend rollover is implemented; state-specific holiday calendars are not.',
  },
  gates: [],
  coveredFromTier: 'GOLD',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    // Intrastate-only carriers do not hold an IFTA licence.
    if (carrier.operationType !== 'INTERSTATE') return []

    return iftaQuartersInWindow(ctx.asOf, ctx.horizonDays).map((quarter) => ({
      ruleId: iftaRule.id,
      type: 'IFTA_QUARTERLY_RETURN' as const,
      carrierId: carrier.id,
      periodLabel: quarter.label,
      dueOn: quarter.dueOn,
      // Records for the quarter cannot be closed out until the quarter itself ends.
      earliestStart: addDays(quarter.quarterEnd, 1),
      citation: iftaRule.citation,
      coveredByTier: tierCovers(carrier.tier, iftaRule.coveredFromTier),
    }))
  },
}
