import type { ObligationType, Tier } from './types'
import { RULES } from './index'

/**
 * Membership pricing, taken from Sky Transport Solutions' published tiers.
 * Priced per truck, per year.
 */
export const TIER_ANNUAL_PRICE: Record<Tier, number> = {
  SILVER: 199,
  GOLD: 299,
  DIAMOND: 399,
}

/** Revenue exposed if this carrier churns: annual membership across the fleet. */
export function annualMembershipValue(tier: Tier, truckCount: number): number {
  return TIER_ANNUAL_PRICE[tier] * truckCount
}

/** Upgrade revenue available from moving a carrier up one or more tiers. */
export function upgradeValue(from: Tier, to: Tier, truckCount: number): number {
  return Math.max(0, (TIER_ANNUAL_PRICE[to] - TIER_ANNUAL_PRICE[from]) * truckCount)
}

export const TIER_ORDER: Tier[] = ['SILVER', 'GOLD', 'DIAMOND']

/** The lowest tier that includes the given obligation type. */
export function requiredTierFor(type: ObligationType): Tier {
  const rule = RULES.find((r) => r.obligationType === type)
  return rule?.coveredFromTier ?? 'SILVER'
}

/** Obligation types included at each tier, for the coverage matrix. */
export function coverageMatrix(): Record<Tier, ObligationType[]> {
  const matrix: Record<Tier, ObligationType[]> = { SILVER: [], GOLD: [], DIAMOND: [] }
  for (const rule of RULES) {
    for (const tier of TIER_ORDER) {
      if (TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(rule.coveredFromTier)) {
        matrix[tier].push(rule.obligationType)
      }
    }
  }
  return matrix
}

/**
 * The cost of a parked truck, used to weigh a compliance miss against the fee earned
 * for preventing it. Deliberately conservative: a mid-range estimate of daily revenue
 * for a single power unit.
 */
export const ESTIMATED_DAILY_REVENUE_PER_TRUCK = 800
