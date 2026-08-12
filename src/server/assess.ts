import type { ObligationType } from '@/rules'
import { computeOutOfService, type BlockEdge, type GraphObligation } from '@/rules/graph'

/**
 * Adapters from persisted rows to the pure graph module.
 *
 * The engine deliberately knows nothing about Prisma, so the translation lives here
 * rather than leaking database types into the rules.
 */

interface PersistedObligation {
  id: string
  type: ObligationType | string
  carrierId: string
  truckId: string | null
  driverId: string | null
  periodLabel: string
  dueOn: Date
  completedAt: Date | null
  citation: string
  blockedBy?: Array<{ blockerId: string; reason: string }>
}

export function toGraphObligations(rows: PersistedObligation[]): GraphObligation[] {
  return rows.map((r) => ({
    id: r.id,
    type: r.type as ObligationType,
    carrierId: r.carrierId,
    truckId: r.truckId,
    driverId: r.driverId,
    periodLabel: r.periodLabel,
    dueOn: r.dueOn,
    completedAt: r.completedAt,
    citation: r.citation,
  }))
}

/** Read the persisted blocker edges back out of the loaded rows. */
export function toBlockEdges(rows: PersistedObligation[]): BlockEdge[] {
  return rows.flatMap((r) =>
    (r.blockedBy ?? []).map((b) => ({
      blockedId: r.id,
      blockerId: b.blockerId,
      reason: b.reason,
    })),
  )
}

export function assessSubject(rows: PersistedObligation[], asOf = new Date()) {
  const obligations = toGraphObligations(rows)
  return computeOutOfService(obligations, toBlockEdges(rows), asOf)
}
