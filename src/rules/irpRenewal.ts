import { addDays, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'
import { findPlateCredential } from './carbCtc'

/** Jurisdictions open the renewal window this far ahead of expiry. */
export const IRP_RENEWAL_WINDOW_DAYS = 90

/**
 * IRP apportioned plate renewal.
 *
 * This is the obligation everything else points at. It is blocked by both the
 * federal heavy vehicle tax receipt and California emissions compliance, so a slip
 * in either of those surfaces here as an out-of-service date.
 */
export const irpRenewalRule: Rule = {
  id: 'irp-plate-renewal',
  name: 'IRP Apportioned Plate Renewal',
  obligationType: 'IRP_RENEWAL',
  scope: 'TRUCK',
  summary:
    'Apportioned registration under the International Registration Plan is renewed annually with the base jurisdiction, with fees apportioned by distance travelled in each member jurisdiction. An expired plate takes the vehicle out of service.',
  derivation:
    'Due on the expiry date recorded on the apportioned plate. The renewal window opens 90 days before expiry, which is the earliest the work can begin.',
  citation: 'International Registration Plan, Article X — Registration and Renewal',
  citationDetail: {
    agency: 'International Registration Plan, Inc. / base jurisdiction DMV',
    authority: 'IRP Plan Article X',
    form: 'Apportioned registration renewal (cab card)',
    url: 'https://www.irponline.org/',
  },
  verification: {
    status: 'NEEDS_REVIEW',
    note:
      'Renewal-on-expiry is correct in general, but expiry dates are STAGGERED and the staggering scheme differs by base jurisdiction. This implementation reads the expiry recorded on the plate credential rather than deriving it, which is accurate where the record is accurate but does not itself encode any jurisdiction schedule.',
  },
  gates: [],
  coveredFromTier: 'DIAMOND',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    const out: DerivedObligation[] = []

    for (const truck of carrier.trucks) {
      if (truck.retiredAt) continue
      const plate = findPlateCredential(truck, carrier.credentials)
      if (!plate?.expiresOn) continue
      if (!withinHorizon(plate.expiresOn, ctx.asOf, ctx.horizonDays)) continue

      out.push({
        ruleId: irpRenewalRule.id,
        type: 'IRP_RENEWAL',
        carrierId: carrier.id,
        truckId: truck.id,
        periodLabel: String(plate.expiresOn.getUTCFullYear() + 1),
        dueOn: plate.expiresOn,
        earliestStart: addDays(plate.expiresOn, -IRP_RENEWAL_WINDOW_DAYS),
        citation: irpRenewalRule.citation,
        coveredByTier: tierCovers(carrier.tier, irpRenewalRule.coveredFromTier),
      })
    }
    return out
  },
}
