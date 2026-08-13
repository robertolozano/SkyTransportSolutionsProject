import { addDays, daysBetween, toUtcDay } from './dates'
import type { GraphObligation } from './graph'
import type { ObligationType } from './types'

/**
 * Scheduling.
 *
 * Two questions the deadline list cannot answer on its own:
 *
 *   1. Backward scheduling — "to hit that date, when must this actually start?"
 *      A due date is not a work date. Each obligation has an earliest legal start,
 *      a handling time, and prerequisites that must clear first.
 *
 *   2. Pull-forward — "which of these can be done early, and does moving them
 *      flatten the peak?" Compliance volume is not evenly distributed; a large
 *      share of it can legally be completed months ahead of the deadline.
 *
 * Pure, like the rest of the engine: no I/O, `asOf` always injected.
 */

/** Typical staff handling time, in working days, from starting a filing to filing it. */
export const HANDLING_DAYS: Record<ObligationType, number> = {
  MCS150_BIENNIAL_UPDATE: 1,
  IFTA_QUARTERLY_RETURN: 3,
  HVUT_FORM_2290: 1,
  // Requires booking a test with a third party, hence the longer lead.
  CARB_CLEAN_TRUCK_CHECK: 10,
  IRP_RENEWAL: 5,
  UCR_RENEWAL: 1,
  MEDICAL_CARD_RENEWAL: 14,
}

/** Buffer held back before the deadline so a late surprise is still recoverable. */
export const SAFETY_BUFFER_DAYS = 5

export interface ScheduledStep {
  obligation: GraphObligation
  /** Latest date work can begin and still finish on time, given downstream prerequisites. */
  startBy: Date
  /** Earliest date the work may legally begin. */
  earliestStart: Date | null
  handlingDays: number
  /** True when startBy has already passed. */
  late: boolean
  /** True when startBy falls before the work is even permitted to begin. */
  impossible: boolean
}

export interface BackwardSchedule {
  steps: ScheduledStep[]
  /** The earliest start-by across the chain — when this account needs attention. */
  actionBy: Date | null
  hasLateStep: boolean
  hasImpossibleStep: boolean
}

/**
 * Walk a dependency chain backwards from its final deadline.
 *
 * Steps are expected in dependency order (root cause first, target last), which is
 * exactly what `computeOutOfService` produces. Each step must finish before the next
 * one can start, so the whole chain compresses backwards from the final due date.
 */
export function backwardSchedule(
  chain: GraphObligation[],
  asOf: Date,
  earliestStarts: Map<string, Date | null> = new Map(),
): BackwardSchedule {
  if (chain.length === 0) {
    return { steps: [], actionBy: null, hasLateStep: false, hasImpossibleStep: false }
  }

  const steps: ScheduledStep[] = []
  // Work backwards. Every step is bound by two constraints at once: its own filing
  // deadline, and the need to clear before the step that depends on it can start.
  // The binding one is whichever comes first.
  let nextStepStartsOn: Date | null = null

  for (let i = chain.length - 1; i >= 0; i--) {
    const obligation = chain[i]
    const handlingDays = HANDLING_DAYS[obligation.type] ?? 1

    const ownDeadline = toUtcDay(obligation.dueOn)
    const downstreamDeadline = nextStepStartsOn ? addDays(nextStepStartsOn, -1) : null
    const deadline =
      downstreamDeadline && downstreamDeadline.getTime() < ownDeadline.getTime()
        ? downstreamDeadline
        : ownDeadline

    const startBy = addDays(deadline, -(handlingDays + SAFETY_BUFFER_DAYS))
    const earliestStart = earliestStarts.get(obligation.id) ?? null

    steps.unshift({
      obligation,
      startBy,
      earliestStart,
      handlingDays,
      late: daysBetween(asOf, startBy) < 0,
      impossible: earliestStart ? startBy.getTime() < toUtcDay(earliestStart).getTime() : false,
    })

    nextStepStartsOn = startBy
  }

  return {
    steps,
    actionBy: steps[0]?.startBy ?? null,
    hasLateStep: steps.some((s) => s.late),
    hasImpossibleStep: steps.some((s) => s.impossible),
  }
}

// ---------------------------------------------------------------------------
// Pull-forward
// ---------------------------------------------------------------------------

export interface MonthLoad {
  /** First day of the month, UTC. */
  month: Date
  count: number
}

export interface PullForwardMove {
  obligationId: string
  type: ObligationType
  carrierId: string
  fromMonth: Date
  toMonth: Date
  dueOn: Date
  earliestStart: Date
}

export interface PullForwardPlan {
  moves: PullForwardMove[]
  before: MonthLoad[]
  after: MonthLoad[]
  peakBefore: number
  peakAfter: number
  /** Share of the peak removed, 0–1. */
  reduction: number
}

interface Movable {
  id: string
  type: ObligationType
  carrierId: string
  dueOn: Date
  earliestStart: Date | null
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/**
 * Move work out of peak months into the earliest month it could legally be done.
 *
 * The constraint that makes this real rather than arbitrary is `earliestStart`: a
 * fuel tax return cannot be filed before its quarter closes, and a plate renewal
 * cannot be filed before the renewal window opens. Only work whose window is already
 * open in an earlier, quieter month is eligible to move.
 */
export function pullForwardPlan(
  obligations: Movable[],
  asOf: Date,
  options: { horizonMonths?: number } = {},
): PullForwardPlan {
  const horizonMonths = options.horizonMonths ?? 12
  const today = toUtcDay(asOf)
  const firstMonth = monthStart(today)

  const months: Date[] = []
  for (let i = 0; i < horizonMonths; i++) {
    months.push(new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1)))
  }
  const monthIndex = new Map(months.map((m, i) => [monthKey(m), i]))

  const inWindow = obligations.filter((o) => monthIndex.has(monthKey(o.dueOn)))

  const load = new Array(horizonMonths).fill(0)
  for (const o of inWindow) load[monthIndex.get(monthKey(o.dueOn))!] += 1

  const before: MonthLoad[] = months.map((m, i) => ({ month: m, count: load[i] }))
  const peakBefore = Math.max(0, ...load)
  const target = Math.ceil(load.reduce((a, b) => a + b, 0) / horizonMonths)

  const working = [...load]
  const moves: PullForwardMove[] = []

  // Heaviest months first; within a month, move the work with the earliest open window.
  const byMonth = [...inWindow].sort(
    (a, b) => working[monthIndex.get(monthKey(b.dueOn))!] - working[monthIndex.get(monthKey(a.dueOn))!],
  )

  for (const o of byMonth) {
    const fromIdx = monthIndex.get(monthKey(o.dueOn))!
    if (working[fromIdx] <= target) continue
    if (!o.earliestStart) continue

    // The earliest month this could be started, but never earlier than today.
    const openFrom = o.earliestStart.getTime() > today.getTime() ? o.earliestStart : today
    const openIdx = monthIndex.get(monthKey(openFrom))
    if (openIdx === undefined || openIdx >= fromIdx) continue

    // Land it in the quietest month between the window opening and the deadline.
    let bestIdx = -1
    for (let i = openIdx; i < fromIdx; i++) {
      if (working[i] >= working[fromIdx] - 1) continue
      if (bestIdx === -1 || working[i] < working[bestIdx]) bestIdx = i
    }
    if (bestIdx === -1) continue

    working[fromIdx] -= 1
    working[bestIdx] += 1
    moves.push({
      obligationId: o.id,
      type: o.type,
      carrierId: o.carrierId,
      fromMonth: months[fromIdx],
      toMonth: months[bestIdx],
      dueOn: o.dueOn,
      earliestStart: o.earliestStart,
    })
  }

  const peakAfter = Math.max(0, ...working)

  return {
    moves,
    before,
    after: months.map((m, i) => ({ month: m, count: working[i] })),
    peakBefore,
    peakAfter,
    reduction: peakBefore === 0 ? 0 : (peakBefore - peakAfter) / peakBefore,
  }
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/**
 * Staffing assumptions.
 *
 * These are ESTIMATES, not measured values, and every surface that uses them says so.
 * A capacity model built on invented handling times reads as authoritative when it is
 * not — so the inputs are stated rather than buried.
 */
export const CAPACITY_ASSUMPTIONS = {
  /** Staff working compliance filings. */
  staffCount: 25,
  /** Productive hours per person per working day, after calls and admin. */
  productiveHoursPerDay: 5.5,
  /** Working days per month. */
  workingDaysPerMonth: 21,
  /** Estimated hours to prepare and submit one filing, by type. */
  hoursPerFiling: {
    MCS150_BIENNIAL_UPDATE: 0.4,
    IFTA_QUARTERLY_RETURN: 1.5,
    HVUT_FORM_2290: 0.5,
    CARB_CLEAN_TRUCK_CHECK: 0.75,
    IRP_RENEWAL: 1.75,
    UCR_RENEWAL: 0.3,
    MEDICAL_CARD_RENEWAL: 0.4,
  } as Record<ObligationType, number>,
}

export function monthlyCapacityHours(): number {
  const { staffCount, productiveHoursPerDay, workingDaysPerMonth } = CAPACITY_ASSUMPTIONS
  return staffCount * productiveHoursPerDay * workingDaysPerMonth
}

export function hoursForFilings(counts: Partial<Record<ObligationType, number>>): number {
  let total = 0
  for (const [type, count] of Object.entries(counts)) {
    total += (CAPACITY_ASSUMPTIONS.hoursPerFiling[type as ObligationType] ?? 0.5) * (count ?? 0)
  }
  return total
}
