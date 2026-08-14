import { describe, expect, it } from 'vitest'
import { utc } from './dates'
import { buildBlockEdges, computeOutOfService, type GraphObligation } from './graph'

/**
 * Dependency topology under simulation.
 *
 * An end-to-end test caught the bug this pins. The what-if simulator used to
 * rebuild the dependency edges from the *simulated* dates — but `buildBlockEdges`
 * only links a prerequisite falling before the deadline it gates, so slipping one
 * past that deadline deleted the edge rather than breaking it. The simulator then
 * reported no problem in precisely the scenario it exists to surface.
 *
 * Topology is a property of the rules, not the calendar: derive it once from the
 * original dates and hold it fixed while the dates move.
 */
function ob(
  partial: Partial<GraphObligation> & Pick<GraphObligation, 'id' | 'type' | 'dueOn'>,
): GraphObligation {
  return { carrierId: 'c1', truckId: 't1', periodLabel: 'p', citation: 'test', ...partial }
}

const asOf = utc(2026, 8, 12)

describe('what-if topology', () => {
  const original = [
    ob({ id: 'ctc', type: 'CARB_CLEAN_TRUCK_CHECK', dueOn: utc(2026, 8, 17) }),
    ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31) }),
    ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 9, 16) }),
  ]

  it('links both prerequisites to the renewal they gate', () => {
    const edges = buildBlockEdges(original)
    expect(edges.filter((e) => e.blockedId === 'irp')).toHaveLength(2)
  })

  it('drops the edge when rebuilt from slipped dates — the trap', () => {
    // Slip the emissions check three months, past the renewal it gates.
    const slipped = original.map((o) =>
      o.id === 'ctc' ? { ...o, dueOn: utc(2026, 12, 15) } : o,
    )
    const rebuilt = buildBlockEdges(slipped)

    // The emissions edge has vanished rather than being violated. Rebuilding
    // from simulated dates therefore cannot detect the breach.
    expect(rebuilt.some((e) => e.blockerId === 'ctc')).toBe(false)
  })

  it('keeps the edge, and so detects the breach, when topology is held fixed', () => {
    const topology = buildBlockEdges(original)
    const slipped = original.map((o) =>
      o.id === 'ctc' ? { ...o, dueOn: utc(2026, 12, 15) } : o,
    )
    const byId = new Map(slipped.map((o) => [o.id, o]))

    const breached = topology.filter((e) => {
      const blocker = byId.get(e.blockerId)!
      const blocked = byId.get(e.blockedId)!
      return blocker.dueOn.getTime() >= blocked.dueOn.getTime()
    })

    expect(breached).toHaveLength(1)
    expect(breached[0].blockerId).toBe('ctc')
  })

  it('still reports the out-of-service date against the fixed topology', () => {
    const topology = buildBlockEdges(original)
    const slipped = original.map((o) =>
      o.id === 'ctc' ? { ...o, dueOn: utc(2026, 12, 15) } : o,
    )

    const assessment = computeOutOfService(slipped, topology, asOf)
    expect(assessment.target?.id).toBe('irp')
    // The slipped prerequisite stays in the chain rather than disappearing.
    expect(assessment.chain.map((o) => o.id)).toContain('ctc')
  })
})
