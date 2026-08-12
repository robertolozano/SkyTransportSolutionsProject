import { describe, expect, it } from 'vitest'
import { utc, isoDay, daysBetween, lastDayOfMonth, nextBusinessDay } from './dates'
import { mcs150DueMonth, mcs150YearParity, nextMcs150Due, mcs150Rule } from './mcs150'
import { iftaQuarter, iftaRule } from './ifta'
import { hvutPeriodFor, hvutRule, HVUT_WEIGHT_THRESHOLD_LBS } from './hvut2290'
import { carbCtcRule, isCtcApplicable } from './carbCtc'
import { irpRenewalRule } from './irpRenewal'
import { ucrRegistrationYearFor, ucrRule } from './ucr'
import { medicalCardRule } from './medicalCard'
import { RULES, deriveAll, statusFor, gateEdges, DEFAULT_HORIZON_DAYS } from './index'
import type { CarrierFacts, DeriveContext } from './types'

const ctx: DeriveContext = { asOf: utc(2026, 8, 12), horizonDays: DEFAULT_HORIZON_DAYS }

function carrier(overrides: Partial<CarrierFacts> = {}): CarrierFacts {
  return {
    id: 'c1',
    dotNumber: '1234567',
    legalName: 'Test Carrier LLC',
    baseState: 'CA',
    operationType: 'INTERSTATE',
    forHire: true,
    hazmat: false,
    tier: 'GOLD',
    trucks: [],
    drivers: [],
    credentials: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------

describe('date helpers', () => {
  it('computes the last day of a month, including leap February', () => {
    expect(isoDay(lastDayOfMonth(2026, 8))).toBe('2026-08-31')
    expect(isoDay(lastDayOfMonth(2026, 2))).toBe('2026-02-28')
    expect(isoDay(lastDayOfMonth(2028, 2))).toBe('2028-02-29')
  })

  it('rolls weekend due dates to Monday', () => {
    // 2026-10-31 is a Saturday.
    expect(isoDay(nextBusinessDay(utc(2026, 10, 31)))).toBe('2026-11-02')
    // A weekday is returned untouched.
    expect(isoDay(nextBusinessDay(utc(2026, 4, 30)))).toBe('2026-04-30')
  })

  it('counts whole days without timezone drift', () => {
    expect(daysBetween(utc(2026, 8, 12), utc(2026, 8, 31))).toBe(19)
    expect(daysBetween(utc(2026, 8, 31), utc(2026, 8, 12))).toBe(-19)
  })
})

// ---------------------------------------------------------------------------

describe('MCS-150 biennial update', () => {
  it('maps the last digit of the USDOT number to a month', () => {
    expect(mcs150DueMonth('1234561')).toBe(1) // January
    expect(mcs150DueMonth('1234569')).toBe(9) // September
    expect(mcs150DueMonth('1234560')).toBe(10) // 0 means October, not December
  })

  it('maps the second-to-last digit to year parity', () => {
    expect(mcs150YearParity('1234571')).toBe(1) // 7 is odd -> odd years
    expect(mcs150YearParity('1234561')).toBe(0) // 6 is even -> even years
  })

  it('derives the next deadline from the number itself', () => {
    // ...61 -> January, even years. As of Aug 2026, the next is January 2028.
    expect(isoDay(nextMcs150Due('1234561', utc(2026, 8, 12)))).toBe('2028-01-31')
    // ...71 -> January, odd years. Next is January 2027.
    expect(isoDay(nextMcs150Due('1234571', utc(2026, 8, 12)))).toBe('2027-01-31')
  })

  it('returns this year when the deadline has not yet passed', () => {
    // ...69 -> September, even years. As of August 2026, September 2026 is still ahead.
    expect(isoDay(nextMcs150Due('1234569', utc(2026, 8, 12)))).toBe('2026-09-30')
  })

  it('rolls past a deadline that has already gone by this year', () => {
    // Same carrier, now asked in October — September has passed, so 2028.
    expect(isoDay(nextMcs150Due('1234569', utc(2026, 10, 1)))).toBe('2028-09-30')
  })

  it('produces exactly one obligation per carrier', () => {
    const out = mcs150Rule.derive(carrier({ dotNumber: '1234569' }), ctx)
    expect(out).toHaveLength(1)
    expect(isoDay(out[0].dueOn)).toBe('2026-09-30')
    expect(out[0].periodLabel).toBe('2026')
  })
})

// ---------------------------------------------------------------------------

describe('IFTA quarterly return', () => {
  it('places each quarter deadline one month after quarter close', () => {
    expect(isoDay(iftaQuarter(2026, 1).dueOn)).toBe('2026-04-30')
    expect(isoDay(iftaQuarter(2026, 2).dueOn)).toBe('2026-07-31')
    // 2026-10-31 falls on a Saturday, so Q3 rolls to Monday.
    expect(isoDay(iftaQuarter(2026, 3).dueOn)).toBe('2026-11-02')
    // Q4 rolls into the following calendar year.
    expect(isoDay(iftaQuarter(2026, 4).dueOn)).toBe('2027-02-01')
  })

  it('cannot start before the quarter has closed', () => {
    const q = iftaQuarter(2026, 3)
    expect(isoDay(q.quarterEnd)).toBe('2026-09-30')
    const out = iftaRule.derive(carrier(), ctx)
    const q3 = out.find((o) => o.periodLabel === '2026 Q3')!
    expect(isoDay(q3.earliestStart!)).toBe('2026-10-01')
  })

  it('does not apply to intrastate-only carriers', () => {
    expect(iftaRule.derive(carrier({ operationType: 'INTRASTATE' }), ctx)).toHaveLength(0)
  })

  it('is not covered at the Silver tier', () => {
    const [first] = iftaRule.derive(carrier({ tier: 'SILVER' }), ctx)
    expect(first.coveredByTier).toBe(false)
    const [gold] = iftaRule.derive(carrier({ tier: 'GOLD' }), ctx)
    expect(gold.coveredByTier).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe('Form 2290 heavy vehicle use tax', () => {
  it('runs a July-to-June tax period due the following August 31', () => {
    const period = hvutPeriodFor(utc(2026, 8, 12))
    expect(period.label).toBe('TY 2026-2027')
    expect(isoDay(period.periodStart)).toBe('2026-07-01')
    expect(isoDay(period.dueOn)).toBe('2026-08-31')
  })

  it('treats January as still inside the period that began last July', () => {
    const period = hvutPeriodFor(utc(2027, 1, 15))
    expect(period.label).toBe('TY 2026-2027')
    expect(isoDay(period.dueOn)).toBe('2026-08-31')
  })

  it('exempts vehicles below the weight threshold', () => {
    const light = carrier({
      trucks: [
        {
          id: 't-light',
          vin: 'V1',
          unitNumber: '1',
          grossWeightLbs: HVUT_WEIGHT_THRESHOLD_LBS - 1,
          plateState: 'CA',
        },
      ],
    })
    expect(hvutRule.derive(light, ctx)).toHaveLength(0)
  })

  it('applies at exactly the threshold weight', () => {
    const heavy = carrier({
      trucks: [
        {
          id: 't-heavy',
          vin: 'V2',
          unitNumber: '2',
          grossWeightLbs: HVUT_WEIGHT_THRESHOLD_LBS,
          plateState: 'CA',
        },
      ],
    })
    const out = hvutRule.derive(heavy, ctx)
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].truckId).toBe('t-heavy')
  })

  it('declares itself a gate on plate renewal', () => {
    expect(hvutRule.gates).toContain('IRP_RENEWAL')
  })
})

// ---------------------------------------------------------------------------

describe('CARB Clean Truck Check', () => {
  const truck = {
    id: 't1',
    vin: 'VIN1',
    unitNumber: '101',
    grossWeightLbs: 80_000,
    plateState: 'CA',
  }

  it('covers heavy vehicles connected to California', () => {
    expect(isCtcApplicable(truck, carrier({ baseState: 'CA' }))).toBe(true)
    expect(isCtcApplicable({ ...truck, plateState: 'NV' }, carrier({ baseState: 'CA' }))).toBe(true)
    expect(isCtcApplicable({ ...truck, plateState: 'NV' }, carrier({ baseState: 'TX' }))).toBe(false)
  })

  it('excludes vehicles at or below the weight rating', () => {
    expect(isCtcApplicable({ ...truck, grossWeightLbs: 14_000 }, carrier())).toBe(false)
  })

  it('places the binding deadline 30 days before plate expiry', () => {
    const c = carrier({
      trucks: [truck],
      credentials: [
        { id: 'cred1', type: 'IRP_PLATE', truckId: 't1', expiresOn: utc(2026, 11, 30) },
      ],
    })
    const out = carbCtcRule.derive(c, ctx)
    const binding = out.find((o) => o.periodLabel.includes('Registration cycle'))!
    expect(isoDay(binding.dueOn)).toBe('2026-10-31')
  })

  it('produces nothing when no plate expiry is on file', () => {
    expect(carbCtcRule.derive(carrier({ trucks: [truck] }), ctx)).toHaveLength(0)
  })

  it('is honestly marked as needing review', () => {
    expect(carbCtcRule.verification.status).toBe('NEEDS_REVIEW')
  })
})

// ---------------------------------------------------------------------------

describe('IRP plate renewal', () => {
  it('is due on plate expiry with a 90-day renewal window', () => {
    const c = carrier({
      trucks: [{ id: 't1', vin: 'V', unitNumber: '1', grossWeightLbs: 80_000, plateState: 'CA' }],
      credentials: [{ id: 'p1', type: 'IRP_PLATE', truckId: 't1', expiresOn: utc(2026, 11, 30) }],
    })
    const [out] = irpRenewalRule.derive(c, ctx)
    expect(isoDay(out.dueOn)).toBe('2026-11-30')
    expect(isoDay(out.earliestStart!)).toBe('2026-09-01')
  })

  it('is only covered at the Diamond tier', () => {
    const c = carrier({
      tier: 'GOLD',
      trucks: [{ id: 't1', vin: 'V', unitNumber: '1', grossWeightLbs: 80_000, plateState: 'CA' }],
      credentials: [{ id: 'p1', type: 'IRP_PLATE', truckId: 't1', expiresOn: utc(2026, 11, 30) }],
    })
    expect(irpRenewalRule.derive(c, ctx)[0].coveredByTier).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('UCR annual registration', () => {
  it('switches to next year\'s registration once October opens', () => {
    expect(ucrRegistrationYearFor(utc(2026, 9, 30))).toBe(2026)
    expect(ucrRegistrationYearFor(utc(2026, 10, 1))).toBe(2027)
  })

  it('is due December 31 of the preceding year', () => {
    const out = ucrRule.derive(carrier(), ctx)
    const y2027 = out.find((o) => o.periodLabel.startsWith('2027'))!
    expect(isoDay(y2027.dueOn)).toBe('2026-12-31')
    expect(isoDay(y2027.earliestStart!)).toBe('2026-10-01')
  })

  it('does not apply to intrastate carriers', () => {
    expect(ucrRule.derive(carrier({ operationType: 'INTRASTATE' }), ctx)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------

describe('medical certificate renewal', () => {
  it('reads the recorded expiry rather than assuming two years', () => {
    const c = carrier({
      drivers: [{ id: 'd1', firstName: 'A', lastName: 'B', hireDate: utc(2024, 1, 1) }],
      credentials: [
        // A short-term certificate — exactly the case an assumed 2-year term would miss.
        { id: 'm1', type: 'MEDICAL_CARD', driverId: 'd1', expiresOn: utc(2026, 9, 20) },
      ],
    })
    const [out] = medicalCardRule.derive(c, ctx)
    expect(isoDay(out.dueOn)).toBe('2026-09-20')
  })

  it('ignores terminated drivers', () => {
    const c = carrier({
      drivers: [
        {
          id: 'd1',
          firstName: 'A',
          lastName: 'B',
          hireDate: utc(2024, 1, 1),
          terminatedAt: utc(2026, 5, 1),
        },
      ],
      credentials: [{ id: 'm1', type: 'MEDICAL_CARD', driverId: 'd1', expiresOn: utc(2026, 9, 20) }],
    })
    expect(medicalCardRule.derive(c, ctx)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------

describe('registry', () => {
  it('gives every rule a citation and a verification marker', () => {
    for (const rule of RULES) {
      expect(rule.citation.length).toBeGreaterThan(10)
      expect(rule.citationDetail.url).toMatch(/^https:\/\//)
      expect(rule.verification.note.length).toBeGreaterThan(20)
    }
  })

  it('has unique rule ids', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length)
  })

  it('derives a sorted, deterministic obligation set', () => {
    const c = carrier({
      trucks: [{ id: 't1', vin: 'V', unitNumber: '1', grossWeightLbs: 80_000, plateState: 'CA' }],
      credentials: [{ id: 'p1', type: 'IRP_PLATE', truckId: 't1', expiresOn: utc(2026, 11, 30) }],
    })
    const first = deriveAll(c, ctx)
    const second = deriveAll(c, ctx)
    expect(first.map((o) => o.ruleId + o.periodLabel)).toEqual(
      second.map((o) => o.ruleId + o.periodLabel),
    )
    for (let i = 1; i < first.length; i++) {
      expect(first[i].dueOn.getTime()).toBeGreaterThanOrEqual(first[i - 1].dueOn.getTime())
    }
  })

  it('exposes both gates into plate renewal', () => {
    const edges = gateEdges()
    const intoIrp = edges.filter((e) => e.blockedType === 'IRP_RENEWAL').map((e) => e.blockerType)
    expect(intoIrp).toContain('HVUT_FORM_2290')
    expect(intoIrp).toContain('CARB_CLEAN_TRUCK_CHECK')
  })
})

describe('status', () => {
  it('classifies by distance from the as-of date', () => {
    const asOf = utc(2026, 8, 12)
    expect(statusFor(utc(2026, 8, 1), asOf)).toBe('OVERDUE')
    expect(statusFor(utc(2026, 8, 31), asOf)).toBe('DUE')
    expect(statusFor(utc(2026, 12, 31), asOf)).toBe('UPCOMING')
  })
})
