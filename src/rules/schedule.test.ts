import { describe, expect, it } from 'vitest'
import { utc, isoDay } from './dates'
import {
  backwardSchedule,
  pullForwardPlan,
  hoursForFilings,
  monthlyCapacityHours,
  HANDLING_DAYS,
  SAFETY_BUFFER_DAYS,
  CAPACITY_ASSUMPTIONS,
} from './schedule'
import { chaseState, documentsToRequest, CHASE_LADDER } from './chase'
import type { GraphObligation } from './graph'

const asOf = utc(2026, 8, 12)

function ob(
  partial: Partial<GraphObligation> & Pick<GraphObligation, 'id' | 'type' | 'dueOn'>,
): GraphObligation {
  return {
    carrierId: 'c1',
    truckId: 't1',
    periodLabel: 'p',
    citation: 'test',
    ...partial,
  }
}

// ---------------------------------------------------------------------------

describe('backward scheduling', () => {
  const chain = [
    ob({ id: 'ctc', type: 'CARB_CLEAN_TRUCK_CHECK', dueOn: utc(2026, 8, 17) }),
    ob({ id: 'hvut', type: 'HVUT_FORM_2290', dueOn: utc(2026, 8, 31) }),
    ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 9, 16) }),
  ]

  it('subtracts handling time and buffer from the final deadline', () => {
    const { steps } = backwardSchedule(chain, asOf)
    const irp = steps.find((s) => s.obligation.id === 'irp')!
    // Sep 16 minus 5 handling days minus 5 buffer days.
    expect(isoDay(irp.startBy)).toBe('2026-09-06')
    expect(irp.handlingDays).toBe(HANDLING_DAYS.IRP_RENEWAL)
  })

  it('compresses earlier steps behind the ones that follow them', () => {
    const { steps } = backwardSchedule(chain, asOf)
    const hvut = steps.find((s) => s.obligation.id === 'hvut')!
    const irp = steps.find((s) => s.obligation.id === 'irp')!
    // The tax filing must finish the day before the renewal can start.
    expect(hvut.startBy.getTime()).toBeLessThan(irp.startBy.getTime())
  })

  it('schedules the emissions test off its own long lead time, not its due date', () => {
    const { steps, actionBy } = backwardSchedule(chain, asOf)
    const ctc = steps[0]
    expect(ctc.obligation.id).toBe('ctc')
    // Ten days of booking lead plus buffer, working back from the tax filing start.
    expect(ctc.handlingDays).toBe(HANDLING_DAYS.CARB_CLEAN_TRUCK_CHECK)
    expect(isoDay(actionBy!)).toBe(isoDay(ctc.startBy))
  })

  it('flags a step whose start date has already passed', () => {
    const late = backwardSchedule(
      [ob({ id: 'irp', type: 'IRP_RENEWAL', dueOn: utc(2026, 8, 14) })],
      asOf,
    )
    expect(late.hasLateStep).toBe(true)
    expect(late.steps[0].late).toBe(true)
  })

  it('flags a step that cannot legally start early enough', () => {
    const plan = backwardSchedule(
      [ob({ id: 'ifta', type: 'IFTA_QUARTERLY_RETURN', dueOn: utc(2026, 11, 2) })],
      asOf,
      // The quarter does not close until October, but work would need to start earlier.
      new Map([['ifta', utc(2026, 12, 1)]]),
    )
    expect(plan.hasImpossibleStep).toBe(true)
  })

  it('returns an empty schedule for an empty chain', () => {
    const empty = backwardSchedule([], asOf)
    expect(empty.steps).toEqual([])
    expect(empty.actionBy).toBeNull()
  })

  it('holds a safety buffer on every step', () => {
    const { steps } = backwardSchedule(chain, asOf)
    for (const step of steps) {
      const gap = Math.round(
        (step.obligation.dueOn.getTime() - step.startBy.getTime()) / 86_400_000,
      )
      expect(gap).toBeGreaterThanOrEqual(step.handlingDays + SAFETY_BUFFER_DAYS)
    }
  })
})

// ---------------------------------------------------------------------------

describe('pull-forward', () => {
  /** Twenty filings all landing in the same month, each openable three months early. */
  function pileUp(count: number, month: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `o${month}-${i}`,
      type: 'IFTA_QUARTERLY_RETURN' as const,
      carrierId: `c${i}`,
      dueOn: utc(2026, month, 15),
      earliestStart: utc(2026, month - 3, 1),
    }))
  }

  it('moves work out of a peak month into quieter ones', () => {
    const plan = pullForwardPlan([...pileUp(24, 11), ...pileUp(2, 9)], asOf)
    expect(plan.moves.length).toBeGreaterThan(0)
    expect(plan.peakAfter).toBeLessThan(plan.peakBefore)
    expect(plan.reduction).toBeGreaterThan(0)
  })

  it('never schedules work before it may legally begin', () => {
    const plan = pullForwardPlan([...pileUp(24, 11), ...pileUp(2, 9)], asOf)
    for (const move of plan.moves) {
      expect(move.toMonth.getTime()).toBeGreaterThanOrEqual(
        new Date(
          Date.UTC(move.earliestStart.getUTCFullYear(), move.earliestStart.getUTCMonth(), 1),
        ).getTime(),
      )
    }
  })

  it('never schedules work into the past', () => {
    const plan = pullForwardPlan(
      [
        ...pileUp(20, 12),
        // Window opened long ago, but today is August.
        {
          id: 'ancient',
          type: 'UCR_RENEWAL' as const,
          carrierId: 'c9',
          dueOn: utc(2026, 12, 31),
          earliestStart: utc(2025, 1, 1),
        },
      ],
      asOf,
    )
    for (const move of plan.moves) {
      expect(move.toMonth.getTime()).toBeGreaterThanOrEqual(utc(2026, 8, 1).getTime())
    }
  })

  it('leaves work alone when it cannot be started early', () => {
    const immovable = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      type: 'HVUT_FORM_2290' as const,
      carrierId: `c${i}`,
      dueOn: utc(2026, 11, 15),
      earliestStart: null,
    }))
    expect(pullForwardPlan(immovable, asOf).moves).toHaveLength(0)
  })

  it('conserves total volume across the plan', () => {
    const plan = pullForwardPlan([...pileUp(24, 11), ...pileUp(2, 9)], asOf)
    const before = plan.before.reduce((s, m) => s + m.count, 0)
    const after = plan.after.reduce((s, m) => s + m.count, 0)
    expect(after).toBe(before)
  })
})

// ---------------------------------------------------------------------------

describe('capacity', () => {
  it('derives monthly hours from the stated assumptions', () => {
    const { staffCount, productiveHoursPerDay, workingDaysPerMonth } = CAPACITY_ASSUMPTIONS
    expect(monthlyCapacityHours()).toBe(staffCount * productiveHoursPerDay * workingDaysPerMonth)
  })

  it('prices a month of filings by type', () => {
    const hours = hoursForFilings({ IFTA_QUARTERLY_RETURN: 100, UCR_RENEWAL: 100 })
    expect(hours).toBeCloseTo(100 * 1.5 + 100 * 0.3, 5)
  })
})

// ---------------------------------------------------------------------------

describe('chase ladder', () => {
  const requested = utc(2026, 8, 1)

  it('waits before the first step fires', () => {
    expect(chaseState(requested, utc(2026, 8, 1)).action).toBe('WAIT')
  })

  it('advances through the ladder as days pass', () => {
    expect(chaseState(requested, utc(2026, 8, 2)).action).toBe('FIRST_REMINDER')
    expect(chaseState(requested, utc(2026, 8, 4)).action).toBe('SECOND_REMINDER')
    expect(chaseState(requested, utc(2026, 8, 8)).action).toBe('STAFF_CALL')
    expect(chaseState(requested, utc(2026, 8, 11)).action).toBe('ESCALATE')
  })

  it('stays escalated rather than wrapping around', () => {
    expect(chaseState(requested, utc(2026, 9, 30)).action).toBe('ESCALATE')
    expect(chaseState(requested, utc(2026, 9, 30)).next).toBeNull()
  })

  it('reports the next step and its distance', () => {
    const state = chaseState(requested, utc(2026, 8, 2))
    expect(state.next?.action).toBe('SECOND_REMINDER')
    expect(state.daysUntilNext).toBe(2)
  })

  it('spends staff time only after cheap channels fail', () => {
    const firstHumanStep = CHASE_LADDER.find((s) => s.action === 'STAFF_CALL')!
    const automated = CHASE_LADDER.filter((s) => s.atDay < firstHumanStep.atDay)
    expect(automated.length).toBeGreaterThanOrEqual(2)
  })
})

describe('document requests', () => {
  const credential = {
    id: 'cred1',
    carrierId: 'c1',
    driverId: 'd1',
    type: 'MEDICAL_CARD',
    expiresOn: utc(2026, 9, 20),
  }

  it('requests inside the lead window', () => {
    const plans = documentsToRequest([credential], asOf)
    expect(plans).toHaveLength(1)
    expect(plans[0].documentType).toBe("Medical examiner's certificate")
    expect(plans[0].daysUntilExpiry).toBe(39)
  })

  it('ignores credentials outside the window', () => {
    const distant = { ...credential, expiresOn: utc(2027, 6, 1) }
    expect(documentsToRequest([distant], asOf)).toHaveLength(0)
  })

  it('requests immediately when the scheduled date has already passed', () => {
    const soon = { ...credential, expiresOn: utc(2026, 8, 20) }
    const [plan] = documentsToRequest([soon], asOf)
    expect(isoDay(plan.requestOn)).toBe(isoDay(asOf))
  })

  it('skips credential types with no document to collect', () => {
    const odd = { ...credential, type: 'PROCESS_AGENT' }
    expect(documentsToRequest([odd], asOf)).toHaveLength(0)
  })

  it('sorts the most urgent first', () => {
    const plans = documentsToRequest(
      [
        { ...credential, id: 'a', expiresOn: utc(2026, 9, 20) },
        { ...credential, id: 'b', expiresOn: utc(2026, 8, 15) },
      ],
      asOf,
    )
    expect(plans.map((p) => p.credentialId)).toEqual(['b', 'a'])
  })
})
