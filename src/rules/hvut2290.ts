import { lastDayOfMonth, toUtcDay, utc, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'

/** Federal heavy vehicle use tax applies at or above this taxable gross weight. */
export const HVUT_WEIGHT_THRESHOLD_LBS = 55_000

/**
 * IRS Form 2290 — Heavy Vehicle Use Tax.
 *
 * The important part is not the tax, it is the receipt. The IRS returns a stamped
 * Schedule 1, and the DMV will not renew apportioned registration without it. That
 * makes this rule a GATE rather than a standalone deadline — which is what the
 * dependency graph exists to express.
 */
export interface HvutPeriod {
  label: string
  periodStart: Date
  dueOn: Date
}

/** The tax period running July 1 – June 30 that contains `asOf`. */
export function hvutPeriodFor(asOf: Date): HvutPeriod {
  const today = toUtcDay(asOf)
  const year = today.getUTCFullYear()
  // Period starts July 1. Before July, we are still inside the period that began last year.
  const startYear = today.getUTCMonth() >= 6 ? year : year - 1
  return {
    label: `TY ${startYear}-${startYear + 1}`,
    periodStart: utc(startYear, 7, 1),
    // Vehicles in use during July report by August 31 of the same year.
    dueOn: lastDayOfMonth(startYear, 8),
  }
}

/** Current period plus the following one, so the next season is always visible. */
export function hvutPeriodsInWindow(asOf: Date, horizonDays: number): HvutPeriod[] {
  const current = hvutPeriodFor(asOf)
  const nextStartYear = current.periodStart.getUTCFullYear() + 1
  const next: HvutPeriod = {
    label: `TY ${nextStartYear}-${nextStartYear + 1}`,
    periodStart: utc(nextStartYear, 7, 1),
    dueOn: lastDayOfMonth(nextStartYear, 8),
  }
  return [current, next].filter((p) => withinHorizon(p.dueOn, asOf, horizonDays))
}

export const hvutRule: Rule = {
  id: 'hvut-form-2290',
  name: 'Form 2290 — Heavy Vehicle Use Tax',
  obligationType: 'HVUT_FORM_2290',
  scope: 'TRUCK',
  summary:
    'Federal excise tax on vehicles with a taxable gross weight of 55,000 lbs or more. The IRS returns a stamped Schedule 1, which states require as proof of payment before they will register or renew the vehicle.',
  derivation:
    'The tax period runs July 1 through June 30. For a vehicle in use at the start of the period, the return is due by August 31 of that year. Vehicles under 55,000 lbs are out of scope.',
  citation: 'IRS Form 2290 Instructions; 26 CFR 41.6001-2 (proof of payment for state registration)',
  citationDetail: {
    agency: 'Internal Revenue Service',
    authority: '26 CFR 41.6001-2',
    form: 'Form 2290 / Schedule 1',
    url: 'https://www.irs.gov/instructions/i2290',
  },
  verification: {
    status: 'VERIFIED_AGAINST_SOURCE',
    note: 'Weight threshold, July–June tax period, and the August 31 deadline for vehicles in use in July are confirmed. Partial-period proration for vehicles first used mid-year is not implemented.',
  },
  // This is the gate that matters: no stamped Schedule 1, no plate renewal.
  gates: ['IRP_RENEWAL'],
  coveredFromTier: 'GOLD',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    const out: DerivedObligation[] = []
    const periods = hvutPeriodsInWindow(ctx.asOf, ctx.horizonDays)

    for (const truck of carrier.trucks) {
      if (truck.retiredAt) continue
      if (truck.grossWeightLbs < HVUT_WEIGHT_THRESHOLD_LBS) continue

      for (const period of periods) {
        out.push({
          ruleId: hvutRule.id,
          type: 'HVUT_FORM_2290',
          carrierId: carrier.id,
          truckId: truck.id,
          periodLabel: period.label,
          dueOn: period.dueOn,
          earliestStart: period.periodStart,
          citation: hvutRule.citation,
          coveredByTier: tierCovers(carrier.tier, hvutRule.coveredFromTier),
        })
      }
    }
    return out
  },
}
