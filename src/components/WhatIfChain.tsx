'use client'

import { useMemo, useState } from 'react'
import { OBLIGATION_LABELS } from '@/rules'
import { addDays, daysBetween, formatDay } from '@/rules/dates'
import { buildBlockEdges, computeOutOfService, type GraphObligation } from '@/rules/graph'
import type { ObligationType } from '@/rules'

/**
 * What-if simulator.
 *
 * Runs the same pure functions the server used to materialize these obligations —
 * the engine has no I/O, so it executes unchanged in the browser. Slipping a
 * prerequisite past the deadline it protects is what turns a scheduling problem into
 * a parked truck, and this makes that moment visible.
 */

export interface WireObligation {
  id: string
  type: ObligationType
  carrierId: string
  truckId: string | null
  driverId: string | null
  periodLabel: string
  dueOn: string
  completedAt: string | null
  citation: string
}

function hydrate(o: WireObligation): GraphObligation {
  return {
    ...o,
    dueOn: new Date(o.dueOn),
    completedAt: o.completedAt ? new Date(o.completedAt) : null,
  }
}

export function WhatIfChain({
  obligations,
  asOfIso,
}: {
  obligations: WireObligation[]
  asOfIso: string
}) {
  const asOf = useMemo(() => new Date(asOfIso), [asOfIso])
  const base = useMemo(() => obligations.map(hydrate), [obligations])

  const open = useMemo(
    () => base.filter((o) => !o.completedAt).sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime()),
    [base],
  )

  const [targetId, setTargetId] = useState<string>(() => open[0]?.id ?? '')
  const [slipDays, setSlipDays] = useState(0)

  const simulated = useMemo(
    () =>
      base.map((o) => (o.id === targetId ? { ...o, dueOn: addDays(o.dueOn, slipDays) } : o)),
    [base, targetId, slipDays],
  )

  const edges = useMemo(() => buildBlockEdges(simulated), [simulated])
  const assessment = useMemo(
    () => computeOutOfService(simulated, edges, asOf),
    [simulated, edges, asOf],
  )

  const byId = useMemo(() => new Map(simulated.map((o) => [o.id, o])), [simulated])

  /**
   * A prerequisite that now falls on or after the deadline it protects cannot clear
   * in time — the downstream filing is unachievable, not merely late.
   */
  const breached = useMemo(() => {
    const out = new Set<string>()
    for (const e of edges) {
      const blocker = byId.get(e.blockerId)
      const blocked = byId.get(e.blockedId)
      if (!blocker || !blocked || blocker.completedAt) continue
      if (blocker.dueOn.getTime() >= blocked.dueOn.getTime()) {
        out.add(e.blockedId)
        out.add(e.blockerId)
      }
    }
    return out
  }, [edges, byId])

  const selected = byId.get(targetId)
  const chain = assessment.chain

  return (
    <div className="rounded-lg border border-edge bg-surface">
      <div className="border-b border-edge px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              What-if
            </h2>
            <p className="mt-1 text-[13px] text-ink-faint">
              Slip a prerequisite and watch what it takes down with it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-md border border-edge-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink"
            >
              {open.map((o) => (
                <option key={o.id} value={o.id}>
                  {OBLIGATION_LABELS[o.type]} — {formatDay(o.dueOn)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-30}
                max={120}
                step={1}
                value={slipDays}
                onChange={(e) => setSlipDays(Number(e.target.value))}
                className="w-44 accent-[color:var(--color-brand)]"
              />
              <span className="numeric w-16 text-[13px] font-medium text-ink">
                {slipDays > 0 ? `+${slipDays}` : slipDays}d
              </span>
              {slipDays !== 0 && (
                <button
                  onClick={() => setSlipDays(0)}
                  className="text-[12px] text-brand hover:underline"
                >
                  reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        {chain.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            Nothing service-critical outstanding for this vehicle.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-stretch gap-1.5">
              {chain.map((node, i) => {
                const isBreached = breached.has(node.id)
                const isTarget = node.id === assessment.target?.id
                const overdue = daysBetween(asOf, node.dueOn) < 0

                const tone = isBreached
                  ? 'border-critical-edge bg-critical-soft'
                  : overdue
                    ? 'border-critical-edge bg-critical-soft'
                    : daysBetween(asOf, node.dueOn) <= 30
                      ? 'border-high-edge bg-high-soft'
                      : 'border-edge bg-surface'

                return (
                  <div key={node.id} className="flex items-stretch gap-1.5">
                    <div
                      className={`min-w-[150px] rounded-md border px-3 py-2 transition-colors ${tone} ${
                        node.id === targetId ? 'ring-2 ring-brand/30' : ''
                      }`}
                    >
                      <div className="text-[11px] font-medium leading-tight text-ink">
                        {OBLIGATION_LABELS[node.type]}
                      </div>
                      <div className="numeric mt-0.5 text-[11px] text-ink-soft">
                        {formatDay(node.dueOn)}
                      </div>
                      {isTarget && (
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                          Out of service
                        </div>
                      )}
                      {isBreached && !isTarget && (
                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-critical">
                          Too late
                        </div>
                      )}
                    </div>
                    {i < chain.length - 1 && (
                      <div className="flex items-center px-0.5 text-ink-faint" aria-hidden>
                        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                          <path
                            d="M0 5h13M9 1l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {breached.size > 0 ? (
              <div className="rounded-md border border-critical-edge bg-critical-soft px-4 py-3">
                <div className="text-[13px] font-semibold text-critical">
                  Chain broken — the vehicle cannot be made legal by{' '}
                  {assessment.date ? formatDay(assessment.date) : 'its deadline'}.
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {selected ? OBLIGATION_LABELS[selected.type] : 'This filing'} now falls on or
                  after the deadline it is a precondition for, so the downstream renewal cannot
                  complete in time.
                </p>
              </div>
            ) : (
              <div className="text-[13px] text-ink-soft">
                {assessment.date && (
                  <>
                    Out of service{' '}
                    <span className="font-medium text-ink">{formatDay(assessment.date)}</span>
                    {assessment.daysRemaining !== null && (
                      <span className="text-ink-faint">
                        {' '}
                        · {assessment.daysRemaining} days from today
                      </span>
                    )}
                    {chain.length > 1 && (
                      <span className="text-ink-faint">
                        {' '}
                        · {chain.length - 1} prerequisite{chain.length - 1 === 1 ? '' : 's'}{' '}
                        outstanding
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
