import { addDays, withinHorizon } from './dates'
import type { CarrierFacts, DeriveContext, DerivedObligation, Rule } from './types'
import { tierCovers } from './types'

/**
 * DOT medical examiner's certificate renewal.
 *
 * Included because it is the most volatile date in the whole system. A healthy
 * driver gets a two-year card; a driver with a monitored condition may get three
 * months. The expiry is therefore per-driver and cannot be inferred from anything
 * except the certificate itself — which is precisely why it gets missed.
 */
export const medicalCardRule: Rule = {
  id: 'medical-card-renewal',
  name: 'DOT Medical Certificate Renewal',
  obligationType: 'MEDICAL_CARD_RENEWAL',
  scope: 'DRIVER',
  summary:
    'Each CDL driver must hold a current medical examiner\'s certificate. An expired certificate disqualifies the driver from operating a commercial vehicle.',
  derivation:
    'Read directly from the expiry date on the certificate on file. Maximum validity is two years, but examiners issue shorter terms for monitored conditions, so the date cannot be derived from the exam date alone.',
  citation: '49 CFR 391.45 — Persons who must be medically examined and certified',
  citationDetail: {
    agency: 'FMCSA',
    authority: '49 CFR 391.45',
    form: 'Medical Examiner\'s Certificate (MCSA-5876)',
    url: 'https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-391/subpart-E/section-391.45',
  },
  verification: {
    status: 'VERIFIED_AGAINST_SOURCE',
    note:
      'Requirement and maximum two-year validity confirmed. This rule reads the recorded expiry rather than inferring it, which is the correct approach given examiners may certify for shorter periods.',
  },
  gates: [],
  coveredFromTier: 'DIAMOND',

  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
    const out: DerivedObligation[] = []

    for (const driver of carrier.drivers) {
      if (driver.terminatedAt) continue

      const card = carrier.credentials.find(
        (c) => c.driverId === driver.id && c.type === 'MEDICAL_CARD' && c.expiresOn,
      )
      if (!card?.expiresOn) continue
      if (!withinHorizon(card.expiresOn, ctx.asOf, ctx.horizonDays)) continue

      out.push({
        ruleId: medicalCardRule.id,
        type: 'MEDICAL_CARD_RENEWAL',
        carrierId: carrier.id,
        driverId: driver.id,
        periodLabel: `Expires ${card.expiresOn.toISOString().slice(0, 10)}`,
        dueOn: card.expiresOn,
        earliestStart: addDays(card.expiresOn, -60),
        citation: medicalCardRule.citation,
        coveredByTier: tierCovers(carrier.tier, medicalCardRule.coveredFromTier),
      })
    }
    return out
  },
}
