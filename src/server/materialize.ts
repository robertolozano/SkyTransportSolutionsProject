import type { PrismaClient } from '@prisma/client'
import { deriveAll, statusFor, DEFAULT_HORIZON_DAYS } from '@/rules'
import type { CarrierFacts } from '@/rules'
import { buildBlockEdges, type GraphObligation } from '@/rules/graph'

/**
 * Materializer — the bridge between the pure rules engine and the database.
 *
 * The engine itself never touches Prisma. This module loads facts, hands them to the
 * engine, and writes the derived obligations back so that book-wide questions become
 * SQL aggregates instead of an application-code loop over every carrier.
 *
 * Completion state is preserved across runs: an obligation already filed stays filed,
 * matched on its natural key (rule + subject + period).
 */

export interface RecomputeOptions {
  asOf?: Date
  horizonDays?: number
  carrierId?: string
}

export interface RecomputeResult {
  runId: string
  carriersProcessed: number
  obligationsWritten: number
  blocksWritten: number
  durationMs: number
}

function naturalKey(o: {
  ruleId: string
  carrierId: string
  truckId?: string | null
  driverId?: string | null
  periodLabel: string
}): string {
  return [o.ruleId, o.carrierId, o.truckId ?? '-', o.driverId ?? '-', o.periodLabel].join('|')
}

export async function recompute(
  prisma: PrismaClient,
  options: RecomputeOptions = {},
): Promise<RecomputeResult> {
  const startedAt = Date.now()
  const asOf = options.asOf ?? new Date()
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS

  const run = await prisma.recomputeRun.create({ data: { asOf } })

  const carriers = await prisma.carrier.findMany({
    where: options.carrierId ? { id: options.carrierId } : undefined,
    include: { trucks: true, drivers: true, credentials: true },
  })

  // Remember what was already completed so a recompute never loses filing history.
  const existing = await prisma.obligation.findMany({
    where: {
      completedAt: { not: null },
      ...(options.carrierId ? { carrierId: options.carrierId } : {}),
    },
    select: {
      ruleId: true,
      carrierId: true,
      truckId: true,
      driverId: true,
      periodLabel: true,
      completedAt: true,
    },
  })
  const completedByKey = new Map(existing.map((o) => [naturalKey(o), o.completedAt!]))

  let obligationsWritten = 0
  let blocksWritten = 0

  for (const carrier of carriers) {
    const facts: CarrierFacts = {
      id: carrier.id,
      dotNumber: carrier.dotNumber,
      legalName: carrier.legalName,
      baseState: carrier.baseState,
      operationType: carrier.operationType,
      forHire: carrier.forHire,
      hazmat: carrier.hazmat,
      tier: carrier.tier,
      trucks: carrier.trucks.map((t) => ({
        id: t.id,
        vin: t.vin,
        unitNumber: t.unitNumber,
        grossWeightLbs: t.grossWeightLbs,
        plateState: t.plateState,
        retiredAt: t.retiredAt,
      })),
      drivers: carrier.drivers.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        hireDate: d.hireDate,
        terminatedAt: d.terminatedAt,
      })),
      credentials: carrier.credentials.map((c) => ({
        id: c.id,
        type: c.type,
        truckId: c.truckId,
        driverId: c.driverId,
        identifier: c.identifier,
        issuedOn: c.issuedOn,
        expiresOn: c.expiresOn,
      })),
    }

    const derived = deriveAll(facts, { asOf, horizonDays })

    // Replace this carrier's derived set wholesale — obligations are computed output,
    // not user-entered records, so rewriting them is the honest operation.
    await prisma.obligation.deleteMany({ where: { carrierId: carrier.id } })

    if (derived.length === 0) continue

    await prisma.obligation.createMany({
      data: derived.map((o) => {
        const completedAt = completedByKey.get(naturalKey(o)) ?? null
        return {
          ruleId: o.ruleId,
          carrierId: o.carrierId,
          truckId: o.truckId ?? null,
          driverId: o.driverId ?? null,
          type: o.type,
          periodLabel: o.periodLabel,
          dueOn: o.dueOn,
          earliestStart: o.earliestStart ?? null,
          status: completedAt ? 'COMPLETED' : statusFor(o.dueOn, asOf),
          coveredByTier: o.coveredByTier,
          citation: o.citation,
          computedAt: asOf,
          completedAt,
        }
      }),
    })
    obligationsWritten += derived.length

    // Instance-level blocker edges for this carrier.
    const persisted = await prisma.obligation.findMany({
      where: { carrierId: carrier.id },
      select: {
        id: true,
        type: true,
        carrierId: true,
        truckId: true,
        driverId: true,
        periodLabel: true,
        dueOn: true,
        completedAt: true,
        citation: true,
      },
    })

    const edges = buildBlockEdges(persisted as GraphObligation[])
    if (edges.length > 0) {
      await prisma.obligationBlock.createMany({
        data: edges.map((e) => ({
          blockedId: e.blockedId,
          blockerId: e.blockerId,
          reason: e.reason,
        })),
        skipDuplicates: true,
      })
      blocksWritten += edges.length
    }
  }

  await prisma.recomputeRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      carriersProcessed: carriers.length,
      obligationsWritten,
      blocksWritten,
    },
  })

  return {
    runId: run.id,
    carriersProcessed: carriers.length,
    obligationsWritten,
    blocksWritten,
    durationMs: Date.now() - startedAt,
  }
}
