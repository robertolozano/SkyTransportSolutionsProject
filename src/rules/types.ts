/**
 * Rules engine — type contracts.
 *
 * This module is deliberately free of any framework, database, or I/O import.
 * It accepts plain facts and returns plain derived obligations, which makes every
 * rule unit-testable against a fixed `asOf` date with no fixtures and no mocking.
 */

export type Tier = 'SILVER' | 'GOLD' | 'DIAMOND'
export type OperationType = 'INTERSTATE' | 'INTRASTATE'

export type CredentialType =
  | 'USDOT_REGISTRATION'
  | 'MC_AUTHORITY'
  | 'INSURANCE'
  | 'PROCESS_AGENT'
  | 'UCR_REGISTRATION'
  | 'IFTA_LICENSE'
  | 'IRP_PLATE'
  | 'HVUT_RECEIPT'
  | 'EMISSIONS_CERT'
  | 'CA_MCP'
  | 'MEDICAL_CARD'
  | 'CDL'

export type ObligationType =
  | 'MCS150_BIENNIAL_UPDATE'
  | 'IFTA_QUARTERLY_RETURN'
  | 'HVUT_FORM_2290'
  | 'CARB_CLEAN_TRUCK_CHECK'
  | 'IRP_RENEWAL'
  | 'UCR_RENEWAL'
  | 'MEDICAL_CARD_RENEWAL'

// ---------------------------------------------------------------------------
// Facts in
// ---------------------------------------------------------------------------

export interface CredentialFacts {
  id: string
  type: CredentialType
  truckId?: string | null
  driverId?: string | null
  identifier?: string | null
  issuedOn?: Date | null
  expiresOn?: Date | null
}

export interface TruckFacts {
  id: string
  vin: string
  unitNumber: string
  grossWeightLbs: number
  plateState: string
  retiredAt?: Date | null
}

export interface DriverFacts {
  id: string
  firstName: string
  lastName: string
  hireDate: Date
  terminatedAt?: Date | null
}

export interface CarrierFacts {
  id: string
  dotNumber: string
  legalName: string
  baseState: string
  operationType: OperationType
  forHire: boolean
  hazmat: boolean
  tier: Tier
  trucks: TruckFacts[]
  drivers: DriverFacts[]
  credentials: CredentialFacts[]
}

// ---------------------------------------------------------------------------
// Obligations out
// ---------------------------------------------------------------------------

export interface DerivedObligation {
  ruleId: string
  type: ObligationType
  carrierId: string
  truckId?: string | null
  driverId?: string | null
  /** Human-readable period this instance covers, e.g. "2026 Q3" or "TY 2026-2027". */
  periodLabel: string
  dueOn: Date
  /** Earliest date the work may legally begin. Drives backward scheduling. */
  earliestStart?: Date | null
  citation: string
  /** True when the carrier's membership tier includes this obligation. */
  coveredByTier: boolean
}

// ---------------------------------------------------------------------------
// Rule metadata
// ---------------------------------------------------------------------------

export interface Citation {
  agency: string
  authority: string
  form?: string
  url: string
}

/**
 * Every rule carries an explicit confidence marker.
 *
 * This exists because encoding regulation from secondary sources is exactly where
 * compliance software quietly goes wrong. A rule that is approximately right is more
 * dangerous than one that announces it needs review — so the /rules page surfaces this
 * to the user rather than hiding it.
 */
export interface Verification {
  status: 'VERIFIED_AGAINST_SOURCE' | 'NEEDS_REVIEW'
  note: string
}

export interface Rule {
  id: string
  name: string
  obligationType: ObligationType
  scope: 'CARRIER' | 'TRUCK' | 'DRIVER'
  /** Plain-English statement of what the obligation is. */
  summary: string
  /** Plain-English statement of how the date is computed. */
  derivation: string
  /** Short citation label, copied onto every obligation this rule produces. */
  citation: string
  /** Structured citation for the /rules page. */
  citationDetail: Citation
  verification: Verification
  /** Obligation types that cannot be completed until this one is. */
  gates: ObligationType[]
  /** Lowest membership tier that includes this work. */
  coveredFromTier: Tier
  derive(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[]
}

export interface DeriveContext {
  /** The date the computation is performed "as of". Always injected, never Date.now(). */
  asOf: Date
  /** How far forward to project recurring obligations. */
  horizonDays: number
}

export const TIER_RANK: Record<Tier, number> = {
  SILVER: 1,
  GOLD: 2,
  DIAMOND: 3,
}

export function tierCovers(carrierTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[carrierTier] >= TIER_RANK[requiredTier]
}
