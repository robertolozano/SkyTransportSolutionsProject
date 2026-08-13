import { addDays, daysBetween } from './dates'

/**
 * Document collection.
 *
 * Two rules, both pure:
 *
 *   1. What should we be asking for, and when. A document tied to an expiring
 *      credential should be requested before it lapses, not after.
 *   2. What happens when nobody answers. The escalation ladder is deterministic —
 *      the follow-up no longer depends on which staff member remembered.
 */

/** Start asking for a replacement this far ahead of expiry. */
export const REQUEST_LEAD_DAYS = 60

export type ChaseAction = 'WAIT' | 'FIRST_REMINDER' | 'SECOND_REMINDER' | 'STAFF_CALL' | 'ESCALATE'

export interface ChaseStep {
  action: ChaseAction
  label: string
  detail: string
  /** Days since the original request at which this step fires. */
  atDay: number
}

/**
 * The escalation ladder.
 *
 * Deliberately front-loaded with low-friction contact: the client is driving, so a
 * text lands and a phone call does not. Human time is only spent once the cheap
 * channels have failed.
 */
export const CHASE_LADDER: ChaseStep[] = [
  {
    action: 'FIRST_REMINDER',
    label: 'Text reminder',
    detail: 'Automated text with a direct upload link. No login required.',
    atDay: 1,
  },
  {
    action: 'SECOND_REMINDER',
    label: 'Second text',
    detail: 'Repeat text, now naming the deadline and what lapses if it is missed.',
    atDay: 3,
  },
  {
    action: 'STAFF_CALL',
    label: 'Staff call task',
    detail: 'Queued for a person to call. First point at which staff time is spent.',
    atDay: 7,
  },
  {
    action: 'ESCALATE',
    label: 'Flag account',
    detail: 'Account flagged for the compliance lead; the affected filing is marked at risk.',
    atDay: 10,
  },
]

export interface ChaseState {
  action: ChaseAction
  step: ChaseStep | null
  daysSinceRequest: number
  /** The next step that has not fired yet, if any. */
  next: ChaseStep | null
  daysUntilNext: number | null
}

/** Where a given request currently sits on the ladder. */
export function chaseState(requestedAt: Date, asOf: Date): ChaseState {
  const elapsed = daysBetween(requestedAt, asOf)

  let current: ChaseStep | null = null
  for (const step of CHASE_LADDER) {
    if (elapsed >= step.atDay) current = step
  }
  const next = CHASE_LADDER.find((s) => s.atDay > elapsed) ?? null

  return {
    action: current?.action ?? 'WAIT',
    step: current,
    daysSinceRequest: elapsed,
    next,
    daysUntilNext: next ? next.atDay - elapsed : null,
  }
}

// ---------------------------------------------------------------------------
// What to request
// ---------------------------------------------------------------------------

export interface ExpiringCredential {
  id: string
  carrierId: string
  truckId?: string | null
  driverId?: string | null
  type: string
  expiresOn: Date
}

export interface DocumentRequestPlan {
  credentialId: string
  carrierId: string
  truckId: string | null
  driverId: string | null
  documentType: string
  /** When the request should go out. */
  requestOn: Date
  expiresOn: Date
  daysUntilExpiry: number
}

/** Human-readable document expected for each credential type. */
export const DOCUMENT_FOR_CREDENTIAL: Record<string, string> = {
  MEDICAL_CARD: "Medical examiner's certificate",
  CDL: 'Commercial driver licence',
  IRP_PLATE: 'Apportioned registration (cab card)',
  INSURANCE: 'Certificate of insurance',
  HVUT_RECEIPT: 'Stamped Schedule 1',
  EMISSIONS_CERT: 'Emissions compliance certificate',
  CA_MCP: 'California motor carrier permit',
  IFTA_LICENSE: 'IFTA licence',
  UCR_REGISTRATION: 'UCR receipt',
}

/**
 * Which replacement documents should be requested now.
 *
 * Converts collection from reactive to scheduled: rather than discovering a lapsed
 * medical card when a driver is pulled over, the request goes out sixty days ahead.
 */
export function documentsToRequest(
  credentials: ExpiringCredential[],
  asOf: Date,
  leadDays: number = REQUEST_LEAD_DAYS,
): DocumentRequestPlan[] {
  const out: DocumentRequestPlan[] = []

  for (const credential of credentials) {
    const daysUntilExpiry = daysBetween(asOf, credential.expiresOn)
    if (daysUntilExpiry > leadDays) continue

    const documentType = DOCUMENT_FOR_CREDENTIAL[credential.type]
    if (!documentType) continue

    const scheduled = addDays(credential.expiresOn, -leadDays)
    out.push({
      credentialId: credential.id,
      carrierId: credential.carrierId,
      truckId: credential.truckId ?? null,
      driverId: credential.driverId ?? null,
      documentType,
      // Anything already inside the window should have gone out already.
      requestOn: scheduled.getTime() < asOf.getTime() ? asOf : scheduled,
      expiresOn: credential.expiresOn,
      daysUntilExpiry,
    })
  }

  return out.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}
