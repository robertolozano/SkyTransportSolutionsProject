import { daysBetween } from './dates'
import { mcs150Rule } from './mcs150'
import { iftaRule } from './ifta'
import { hvutRule } from './hvut2290'
import { carbCtcRule } from './carbCtc'
import { irpRenewalRule } from './irpRenewal'
import { ucrRule } from './ucr'
import { medicalCardRule } from './medicalCard'
import type {
  CarrierFacts,
  DeriveContext,
  DerivedObligation,
  ObligationType,
  Rule,
} from './types'

export * from './types'
export * from './dates'

/** The rule registry. Adding a rule here is the only step needed to extend the engine. */
export const RULES: Rule[] = [
  mcs150Rule,
  iftaRule,
  hvutRule,
  carbCtcRule,
  irpRenewalRule,
  ucrRule,
  medicalCardRule,
]

export const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]))

export const DEFAULT_HORIZON_DAYS = 540

/**
 * Run every applicable rule over one carrier.
 *
 * Pure: same facts and same `asOf` always produce the same obligations.
 */
export function deriveAll(carrier: CarrierFacts, ctx: DeriveContext): DerivedObligation[] {
  return RULES.flatMap((rule) => rule.derive(carrier, ctx)).sort(
    (a, b) => a.dueOn.getTime() - b.dueOn.getTime(),
  )
}

export type ObligationStatus = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED'

/** Due within this many days counts as actionable rather than merely upcoming. */
export const DUE_SOON_DAYS = 30

export function statusFor(dueOn: Date, asOf: Date): ObligationStatus {
  const days = daysBetween(asOf, dueOn)
  if (days < 0) return 'OVERDUE'
  if (days <= DUE_SOON_DAYS) return 'DUE'
  return 'UPCOMING'
}

// ---------------------------------------------------------------------------
// Type-level dependency graph, derived from the rules themselves
// ---------------------------------------------------------------------------

export interface GateEdge {
  blockerType: ObligationType
  blockedType: ObligationType
  reason: string
  citation: string
}

/**
 * The gate edges are declared on the rules, not maintained separately, so the graph
 * can never drift out of step with the engine that produces the obligations.
 */
export function gateEdges(): GateEdge[] {
  const edges: GateEdge[] = []
  for (const rule of RULES) {
    for (const blockedType of rule.gates) {
      edges.push({
        blockerType: rule.obligationType,
        blockedType,
        reason: gateReason(rule.obligationType, blockedType),
        citation: rule.citation,
      })
    }
  }
  return edges
}

function gateReason(blocker: ObligationType, blocked: ObligationType): string {
  const key = `${blocker}->${blocked}`
  const reasons: Record<string, string> = {
    'HVUT_FORM_2290->IRP_RENEWAL':
      'The DMV will not renew apportioned registration without the stamped Schedule 1 returned by the IRS as proof of heavy vehicle use tax payment.',
    'CARB_CLEAN_TRUCK_CHECK->IRP_RENEWAL':
      'California places a registration hold on any heavy-duty vehicle that has not demonstrated Clean Truck Check compliance, blocking renewal until it clears.',
  }
  return reasons[key] ?? `${blocker} must be completed before ${blocked} can proceed.`
}

export const OBLIGATION_LABELS: Record<ObligationType, string> = {
  MCS150_BIENNIAL_UPDATE: 'MCS-150 Biennial Update',
  IFTA_QUARTERLY_RETURN: 'IFTA Quarterly Return',
  HVUT_FORM_2290: 'Form 2290 (HVUT)',
  CARB_CLEAN_TRUCK_CHECK: 'CARB Clean Truck Check',
  IRP_RENEWAL: 'IRP Plate Renewal',
  UCR_RENEWAL: 'UCR Registration',
  MEDICAL_CARD_RENEWAL: 'Medical Certificate',
}

export const OBLIGATION_SHORT: Record<ObligationType, string> = {
  MCS150_BIENNIAL_UPDATE: 'MCS-150',
  IFTA_QUARTERLY_RETURN: 'IFTA',
  HVUT_FORM_2290: '2290',
  CARB_CLEAN_TRUCK_CHECK: 'CTC',
  IRP_RENEWAL: 'IRP',
  UCR_RENEWAL: 'UCR',
  MEDICAL_CARD_RENEWAL: 'Med Card',
}
