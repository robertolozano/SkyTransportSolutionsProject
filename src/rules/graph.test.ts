import { describe, expect, it } from 'vitest'
import { utc, isoDay } from './dates'
import { buildBlockEdges, computeOutOfService, riskLevel, type GraphObligation } from './graph'

const asOf = utc(2026, 8, 12)

function ob(partial: Partial<GraphObligation> & Pick<GraphObligation, 'id' | 'type' | 'dueOn'>): GraphObligation {
  return {
    carrierId: 'c1',
    truckId: 't1',
    periodLabel: 'p',
    citation: 'test',
    ...partial,
  }
}

describe('dependency edges', () => {
  it('links the tax filing and emissions check to the plate renewal they gate', () => {
    const obligations = [
      ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31) }),
      ob({ id: 'ctc', type: 'CARB_CLEAN_TRUCK_CHECK', dueOn: utc(2026, 10, 31) }),
      ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30) }),
    ]
    const edges = buildBlockEdges(obligations)
    const blockers = edges.filter((e) => e.blockedId === 'irp').map((e) => e.blockerId)
    expect(blockers).toContain('hvut')
    expect(blockers).toContain('ctc')
  })

  it('does not link obligations belonging to different trucks', () => {
    const obligations = [
      ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31), truckId: 't1' }),
      ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30), truckId: 't2' }),
    ]
    expect(buildBlockEdges(obligations)).toHaveLength(0)
  })

  it('ignores a prerequisite falling after the deadline it would gate', () => {
    const obligations = [
      // Next year's tax filing cannot be the blocker for this year's renewal.
      ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2027, 8, 31) }),
      ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30) }),
    ]
    expect(buildBlockEdges(obligations)).toHaveLength(0)
  })

  it('binds to the most recent qualifying prerequisite', () => {
    const obligations = [
      ob({ id: 'hvut-old', type: 'HVUT_FORM_2290', dueOn: utc(2025, 8, 31) }),
      ob({ id: 'hvut-new', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31) }),
      ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30) }),
    ]
    const edges = buildBlockEdges(obligations).filter(
      (e) => e.blockedId === 'irp' && e.blockerId.startsWith('hvut'),
    )
    expect(edges).toHaveLength(1)
    expect(edges[0].blockerId).toBe('hvut-new')
  })
})

describe('out-of-service assessment', () => {
  const obligations = [
    ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31) }),
    ob({ id: 'ctc', type: 'CARB_CLEAN_TRUCK_CHECK', dueOn: utc(2026, 10, 31) }),
    ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30) }),
  ]

  it('reports the date the truck stops being legal', () => {
    const edges = buildBlockEdges(obligations)
    const result = computeOutOfService(obligations, edges, asOf)
    expect(isoDay(result.date!)).toBe('2026-11-30')
    expect(result.target!.id).toBe('irp')
    expect(result.daysRemaining).toBe(110)
  })

  it('traces the root cause three steps upstream', () => {
    const edges = buildBlockEdges(obligations)
    const result = computeOutOfService(obligations, edges, asOf)
    // Root cause is the earliest unmet prerequisite, not the deadline itself.
    expect(result.rootCause!.id).toBe('hvut')
    expect(result.chain.map((o) => o.id)).toEqual(['hvut', 'ctc', 'irp'])
  })

  it('drops prerequisites that are already completed from the chain', () => {
    const done = obligations.map((o) =>
      o.id === 'hvut' ? { ...o, completedAt: utc(2026, 7, 20) } : o,
    )
    const result = computeOutOfService(done, buildBlockEdges(done), asOf)
    expect(result.rootCause!.id).toBe('ctc')
    expect(result.chain.map((o) => o.id)).toEqual(['ctc', 'irp'])
  })

  it('returns no date when nothing service-critical is outstanding', () => {
    const nonCritical = [ob({ id: 'ifta', type: 'IFTA_QUARTERLY_RETURN', dueOn: utc(2026, 10, 31) })]
    const result = computeOutOfService(nonCritical, [], asOf)
    expect(result.date).toBeNull()
    expect(result.chain).toEqual([])
  })

  it('picks the earliest service-critical deadline when several are open', () => {
    const many = [
      ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 11, 30) }),
      ob({ id: 'mcs', type: 'MCS150_BIENNIAL_UPDATE', dueOn: utc(2026, 9, 30), truckId: null }),
    ]
    const result = computeOutOfService(many, buildBlockEdges(many), asOf)
    expect(result.target!.id).toBe('mcs')
  })
})

describe('risk banding', () => {
  it('bands by days remaining', () => {
    expect(riskLevel(-1)).toBe('CRITICAL')
    expect(riskLevel(0)).toBe('HIGH')
    expect(riskLevel(30)).toBe('HIGH')
    expect(riskLevel(31)).toBe('MEDIUM')
    expect(riskLevel(91)).toBe('LOW')
    expect(riskLevel(null)).toBe('LOW')
  })
})
