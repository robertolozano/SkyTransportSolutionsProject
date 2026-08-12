import { daysBetween } from './dates'
import { gateEdges } from './index'
import type { ObligationType } from './types'

/**
 * Dependency graph over materialized obligations.
 *
 * The type-level gates say "filing X blocks filing Y". This module turns those into
 * instance-level edges between actual obligations, and then answers the question the
 * whole product exists to answer: on what date does this truck stop being legal, and
 * what upstream item is actually causing it?
 */

export interface GraphObligation {
  id: string
  type: ObligationType
  carrierId: string
  truckId?: string | null
  driverId?: string | null
  periodLabel: string
  dueOn: Date
  completedAt?: Date | null
  citation: string
}

export interface BlockEdge {
  blockedId: string
  blockerId: string
  reason: string
}

/**
 * Obligations whose lapse directly removes the right to operate.
 *
 * Everything else in the system is dangerous only because it eventually blocks one
 * of these — which is why they anchor the out-of-service calculation.
 */
export const SERVICE_CRITICAL: ObligationType[] = ['IRP_RENEWAL', 'MCS150_BIENNIAL_UPDATE']

/** Only look this far back for a prerequisite that belongs to the same cycle. */
const PREREQUISITE_LOOKBACK_DAYS = 365

/**
 * Match each blocked obligation to the prerequisite instance that actually governs it:
 * the same subject, the same cycle, and the latest qualifying blocker before it.
 */
export function buildBlockEdges(obligations: GraphObligation[]): BlockEdge[] {
  const edges: BlockEdge[] = []
  const byType = new Map<ObligationType, GraphObligation[]>()
  for (const o of obligations) {
    const list = byType.get(o.type) ?? []
    list.push(o)
    byType.set(o.type, list)
  }

  for (const gate of gateEdges()) {
    const blocked = byType.get(gate.blockedType) ?? []
    const candidates = byType.get(gate.blockerType) ?? []

    for (const target of blocked) {
      const relevant = candidates.filter((c) => {
        // A truck-scoped obligation is only gated by work on the same truck.
        if (target.truckId || c.truckId) {
          if (target.truckId !== c.truckId) return false
        } else if (target.carrierId !== c.carrierId) {
          return false
        }
        const lead = daysBetween(c.dueOn, target.dueOn)
        return lead >= 0 && lead <= PREREQUISITE_LOOKBACK_DAYS
      })

      if (relevant.length === 0) continue
      // The binding prerequisite is the one immediately preceding the deadline.
      const blocker = relevant.reduce((a, b) => (a.dueOn > b.dueOn ? a : b))
      edges.push({ blockedId: target.id, blockerId: blocker.id, reason: gate.reason })
    }
  }
  return edges
}

export interface OutOfServiceAssessment {
  /** The date the subject stops being legal to operate, if one is projected. */
  date: Date | null
  daysRemaining: number | null
  /** The obligation whose lapse causes it. */
  target: GraphObligation | null
  /** Unmet prerequisites, root cause first, ending with the target. */
  chain: GraphObligation[]
  rootCause: GraphObligation | null
}

const EMPTY: OutOfServiceAssessment = {
  date: null,
  daysRemaining: null,
  target: null,
  chain: [],
  rootCause: null,
}

/**
 * Compute the out-of-service date for a set of obligations belonging to one subject.
 *
 * `asOf` is injected rather than read from the clock so this is deterministic and
 * directly testable, and so the what-if simulator can re-run it against a moved date.
 */
export function computeOutOfService(
  obligations: GraphObligation[],
  edges: BlockEdge[],
  asOf: Date,
): OutOfServiceAssessment {
  const open = obligations.filter((o) => !o.completedAt)
  const critical = open
    .filter((o) => SERVICE_CRITICAL.includes(o.type))
    .sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime())

  const target = critical[0]
  if (!target) return EMPTY

  const byId = new Map(obligations.map((o) => [o.id, o]))
  const blockersOf = new Map<string, string[]>()
  for (const e of edges) {
    const list = blockersOf.get(e.blockedId) ?? []
    list.push(e.blockerId)
    blockersOf.set(e.blockedId, list)
  }

  // Collect every unmet prerequisite upstream of the target, not just one path —
  // a plate renewal can be held by the tax filing AND the emissions check at once,
  // and the operator needs to see both. Completed prerequisites are pruned, and we
  // do not traverse through them, since their own blockers no longer matter.
  const outstanding = new Map<string, GraphObligation>()
  const visited = new Set<string>([target.id])
  const queue: string[] = [target.id]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const blockerId of blockersOf.get(current) ?? []) {
      if (visited.has(blockerId)) continue
      visited.add(blockerId)

      const blocker = byId.get(blockerId)
      if (!blocker || blocker.completedAt) continue

      outstanding.set(blockerId, blocker)
      queue.push(blockerId)
    }
  }

  const chain: GraphObligation[] = [
    ...[...outstanding.values()].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime()),
    target,
  ]

  return {
    date: target.dueOn,
    daysRemaining: daysBetween(asOf, target.dueOn),
    target,
    chain,
    rootCause: chain[0] ?? null,
  }
}

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export function riskLevel(daysRemaining: number | null): RiskLevel {
  if (daysRemaining === null) return 'LOW'
  if (daysRemaining < 0) return 'CRITICAL'
  if (daysRemaining <= 30) return 'HIGH'
  if (daysRemaining <= 90) return 'MEDIUM'
  return 'LOW'
}
