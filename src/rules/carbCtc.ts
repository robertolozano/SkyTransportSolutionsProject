import { addDays, addMonths, withinHorizon } from './dates'
import type { CarrierFacts, CredentialFacts, DeriveContext, DerivedObligation, Rule, TruckFacts } from './types'
import { tierCovers } from './types'

/** CARB's Clean Truck Check covers non-gasoline vehicles above this weight rating. */
export const CTC_WEIGHT_THRESHOLD_LBS = 14_000

/** Compliance must be demonstrated this far ahead of registration to clear the DMV hold. */
export const CTC_LEAD_DAYS = 30

export function findPlateCredential(
  truck: TruckFacts,
  credentials: CredentialFacts[],
): CredentialFacts | undefined {
  return credentials.find((c) => c.truckId === truck.id && c.type === 'IRP_PLATE' && c.expiresOn)
}

/**
 * Does this truck fall under the California Clean Truck Check?
 *
 * Scope is operational, not just registrational — a vehicle operating in California
 * is covered regardless of where it is plated. We approximate "operates in CA" with
 * the carrier's base state or the plate state, which is the best available signal
 * from the data we hold.
 */
export function isCtcApplicable(truck: TruckFacts, carrier: CarrierFacts): boolean {
  if (truck.retiredAt) return false
  if (truck.grossWeightLbs <= CTC_WEIGHT_THRESHOLD_LBS) return false
  return carrier.baseState === 'CA' || truck.plateState === 'CA'
}

export const carbCtcRule: Rule = {
  id: 'carb-clean-truck-check',
  name: 'CARB Clean Truck Check',
  obligationType: 'CARB_CLEAN_TRUCK_CHECK',
  scope: 'TRUCK',
  summary:
    'California requires periodic emissions compliance testing and reporting for heavy-duty vehicles operating in the state. The DMV will block registration renewal for a vehicle that is not compliant.',
  derivation:
    'Compliance is tied to the vehicle registration cycle. This implementation schedules a semiannual test, with the binding deadline placed 30 days before the apportioned plate expires so the DMV hold clears in time for renewal.',
  citation: '13 CCR §2196 — Heavy-Duty Inspection and Maintenance (Clean Truck Check)',
  citationDetail: {
    agency: 'California Air Resources Board',
    authority: '13 CCR §2196',
    form: 'Clean Truck Check — Vehicle Inspection System (CTC-VIS)',
    url: 'https://ww2.arb.ca.gov/our-work/programs/clean-truck-check-hd-im',
  },
  verification: {
    status: 'NEEDS_REVIEW',
    note:
      'The gating relationship to DMV registration is well established and is what this rule models. The testing CADENCE is the uncertain part — the program phased in from annual toward twice-yearly compliance, and the applicable frequency depends on vehicle type and reporting year. The semiannual schedule used here should be confirmed against the current CARB compliance calendar before any operational use.',
  },
  // No emissions compliance means no registration renewal.
  gates: ['IRP_RENEWAL'],
  coveredFromTier: 'SILVER',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    const out: DerivedObligation[] = []

    for (const truck of carrier.trucks) {
      if (!isCtcApplicable(truck, carrier)) continue

      const plate = findPlateCredential(truck, carrier.credentials)
      if (!plate?.expiresOn) continue

      // Binding deadline: clear the DMV hold ahead of registration renewal.
      const registrationDeadline = addDays(plate.expiresOn, -CTC_LEAD_DAYS)
      // Second compliance event six months earlier in the cycle.
      const midCycleDeadline = addMonths(registrationDeadline, -6)

      const events = [
        { label: 'Registration cycle', due: registrationDeadline },
        { label: 'Mid-cycle', due: midCycleDeadline },
      ]

      for (const event of events) {
        if (!withinHorizon(event.due, ctx.asOf, ctx.horizonDays)) continue
        out.push({
          ruleId: carbCtcRule.id,
          type: 'CARB_CLEAN_TRUCK_CHECK',
          carrierId: carrier.id,
          truckId: truck.id,
          periodLabel: `${event.due.getUTCFullYear()} ${event.label}`,
          dueOn: event.due,
          earliestStart: addDays(event.due, -90),
          citation: carbCtcRule.citation,
          coveredByTier: tierCovers(carrier.tier, carbCtcRule.coveredFromTier),
        })
      }
    }
    return out
  },
}
