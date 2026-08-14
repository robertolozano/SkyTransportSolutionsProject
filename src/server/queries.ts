import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'
import type { ObligationType, Tier } from '@/rules'

/**
 * Read layer.
 *
 * Relational reads go through Prisma. The book-wide aggregates below are written as
 * SQL because they are genuinely aggregate work — ranking every open obligation
 * against fleet-level revenue exposure, bucketing a year of deadlines by month,
 * comparing coverage against tier. Expressing these through an ORM would be slower
 * and harder to read than the query itself.
 */

// --- shared SQL fragments ----------------------------------------------------

/** Membership value per carrier: annual per-truck price across the active fleet. */
const REVENUE_EXPR = Prisma.sql`
  (CASE c.tier
     WHEN 'SILVER'  THEN ${TIER_ANNUAL_PRICE.SILVER}
     WHEN 'GOLD'    THEN ${TIER_ANNUAL_PRICE.GOLD}
     WHEN 'DIAMOND' THEN ${TIER_ANNUAL_PRICE.DIAMOND}
   END) * GREATEST(fleet.truck_count, 1)
`

const FLEET_JOIN = Prisma.sql`
  LEFT JOIN (
    SELECT "carrierId", COUNT(*)::int AS truck_count
    FROM "Truck" WHERE "retiredAt" IS NULL
    GROUP BY "carrierId"
  ) fleet ON fleet."carrierId" = c.id
`

// --- 1. work queue -----------------------------------------------------------

export interface WorkQueueRow {
  obligationId: string
  type: ObligationType
  periodLabel: string
  dueOn: Date
  daysLeft: number
  status: string
  coveredByTier: boolean
  citation: string
  carrierId: string
  dotNumber: string
  legalName: string
  tier: Tier
  truckId: string | null
  unitNumber: string | null
  vin: string | null
  driverName: string | null
  revenueAtRisk: number
  blockingCount: number
}

/**
 * The dashboard queue: every open obligation ranked by urgency, carrying the revenue
 * exposed behind it and how many downstream items it is currently holding up.
 */
export async function getWorkQueue(limit = 60): Promise<WorkQueueRow[]> {
  return prisma.$queryRaw<WorkQueueRow[]>`
    SELECT
      o.id                          AS "obligationId",
      o.type::text                  AS type,
      o."periodLabel"               AS "periodLabel",
      o."dueOn"                     AS "dueOn",
      (o."dueOn"::date - CURRENT_DATE)::int AS "daysLeft",
      o.status::text                AS status,
      o."coveredByTier"             AS "coveredByTier",
      o.citation                    AS citation,
      c.id                          AS "carrierId",
      c."dotNumber"                 AS "dotNumber",
      c."legalName"                 AS "legalName",
      c.tier::text                  AS tier,
      t.id                          AS "truckId",
      t."unitNumber"                AS "unitNumber",
      t.vin                         AS vin,
      CASE WHEN d.id IS NOT NULL
           THEN d."firstName" || ' ' || d."lastName" END AS "driverName",
      ${REVENUE_EXPR}::int          AS "revenueAtRisk",
      COALESCE(blk.blocking_count, 0)::int AS "blockingCount"
    FROM "Obligation" o
    JOIN "Carrier" c ON c.id = o."carrierId"
    ${FLEET_JOIN}
    LEFT JOIN "Truck"  t ON t.id = o."truckId"
    LEFT JOIN "Driver" d ON d.id = o."driverId"
    LEFT JOIN (
      SELECT ob."blockerId", COUNT(*)::int AS blocking_count
      FROM "ObligationBlock" ob
      JOIN "Obligation" blocked ON blocked.id = ob."blockedId"
      WHERE blocked.status <> 'COMPLETED'
      GROUP BY ob."blockerId"
    ) blk ON blk."blockerId" = o.id
    WHERE o.status <> 'COMPLETED'
      AND o."dueOn" <= CURRENT_DATE + INTERVAL '120 days'
    ORDER BY
      -- Overdue first, then by how soon, then by what is riding on it.
      (o."dueOn"::date - CURRENT_DATE) ASC,
      COALESCE(blk.blocking_count, 0) DESC,
      ${REVENUE_EXPR} DESC
    LIMIT ${limit}
  `
}

// --- 2. book-wide summary ----------------------------------------------------

export interface BookSummary {
  carriers: number
  trucks: number
  overdue: number
  dueSoon: number
  trucksAtRisk: number
  revenueAtRisk: number
  uncoveredObligations: number
}

export async function getBookSummary(): Promise<BookSummary> {
  const [row] = await prisma.$queryRaw<
    Array<{
      carriers: number
      trucks: number
      overdue: number
      dueSoon: number
      trucksAtRisk: number
      revenueAtRisk: number
      uncoveredObligations: number
    }>
  >`
    WITH open_obligations AS (
      SELECT o.*, c.tier, c.id AS carrier_id
      FROM "Obligation" o
      JOIN "Carrier" c ON c.id = o."carrierId"
      WHERE o.status <> 'COMPLETED'
    ),
    at_risk_trucks AS (
      -- A truck is at risk when a service-critical obligation lands within 30 days.
      SELECT DISTINCT "truckId"
      FROM open_obligations
      WHERE "truckId" IS NOT NULL
        AND type = 'IRP_RENEWAL'
        AND "dueOn" <= CURRENT_DATE + INTERVAL '30 days'
    ),
    at_risk_carriers AS (
      SELECT DISTINCT c.id, c.tier
      FROM open_obligations o
      JOIN "Carrier" c ON c.id = o.carrier_id
      WHERE o."dueOn" <= CURRENT_DATE + INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM "Carrier")                                   AS carriers,
      (SELECT COUNT(*)::int FROM "Truck" WHERE "retiredAt" IS NULL)           AS trucks,
      (SELECT COUNT(*)::int FROM open_obligations WHERE status = 'OVERDUE')   AS overdue,
      (SELECT COUNT(*)::int FROM open_obligations WHERE status = 'DUE')       AS "dueSoon",
      (SELECT COUNT(*)::int FROM at_risk_trucks)                              AS "trucksAtRisk",
      (SELECT COALESCE(SUM(
          (CASE arc.tier
             WHEN 'SILVER'  THEN ${TIER_ANNUAL_PRICE.SILVER}
             WHEN 'GOLD'    THEN ${TIER_ANNUAL_PRICE.GOLD}
             WHEN 'DIAMOND' THEN ${TIER_ANNUAL_PRICE.DIAMOND}
           END) * GREATEST(COALESCE(f.truck_count, 1), 1)
        ), 0)::int
        FROM at_risk_carriers arc
        LEFT JOIN (
          SELECT "carrierId", COUNT(*)::int AS truck_count
          FROM "Truck" WHERE "retiredAt" IS NULL GROUP BY "carrierId"
        ) f ON f."carrierId" = arc.id
      )                                                                       AS "revenueAtRisk",
      (SELECT COUNT(*)::int FROM open_obligations WHERE "coveredByTier" = false) AS "uncoveredObligations"
  `
  return row
}

// --- 3. carrier list ---------------------------------------------------------

export interface CarrierRiskRow {
  id: string
  dotNumber: string
  legalName: string
  city: string
  state: string
  tier: Tier
  status: 'PROSPECT' | 'ACTIVE'
  contactName: string | null
  recommendedPackage: string | null
  recommendedPrice: number | null
  operationType: string
  truckCount: number
  openCount: number
  overdueCount: number
  uncoveredCount: number
  nextDueOn: Date | null
  outOfServiceOn: Date | null
  daysToOutOfService: number | null
  revenueAtRisk: number
}

export async function getCarrierRisk(): Promise<CarrierRiskRow[]> {
  return prisma.$queryRaw<CarrierRiskRow[]>`
    SELECT
      c.id, c."dotNumber", c."legalName", c.city, c.state,
      c.tier::text AS tier,
      c.status::text AS status,
      c."contactName", c."recommendedPackage", c."recommendedPrice",
      c."operationType"::text AS "operationType",
      COALESCE(fleet.truck_count, 0)::int AS "truckCount",
      COALESCE(agg.open_count, 0)::int      AS "openCount",
      COALESCE(agg.overdue_count, 0)::int   AS "overdueCount",
      COALESCE(agg.uncovered_count, 0)::int AS "uncoveredCount",
      agg.next_due                          AS "nextDueOn",
      agg.oos_date                          AS "outOfServiceOn",
      (agg.oos_date::date - CURRENT_DATE)::int AS "daysToOutOfService",
      ${REVENUE_EXPR}::int                  AS "revenueAtRisk"
    FROM "Carrier" c
    ${FLEET_JOIN}
    LEFT JOIN (
      SELECT
        "carrierId",
        COUNT(*)::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'OVERDUE')::int AS overdue_count,
        COUNT(*) FILTER (WHERE "coveredByTier" = false)::int AS uncovered_count,
        MIN("dueOn") AS next_due,
        -- Service-critical obligations are the ones that actually park a truck.
        MIN("dueOn") FILTER (
          WHERE type IN ('IRP_RENEWAL', 'MCS150_BIENNIAL_UPDATE')
        ) AS oos_date
      FROM "Obligation"
      WHERE status <> 'COMPLETED'
      GROUP BY "carrierId"
    ) agg ON agg."carrierId" = c.id
    -- New leads first: a prospect waiting on a callback is more urgent than a
    -- client whose next deadline is nine months out. Within each group the sort
    -- differs — prospects by how recently they arrived, clients by risk — so the
    -- date key is scoped by status rather than applied to everyone.
    ORDER BY
      (c.status = 'PROSPECT') DESC,
      CASE WHEN c.status = 'PROSPECT' THEN c."createdAt" END DESC,
      agg.oos_date ASC NULLS LAST
  `
}

// --- 4. coverage gaps --------------------------------------------------------

export interface CoverageGapRow {
  carrierId: string
  dotNumber: string
  legalName: string
  tier: Tier
  truckCount: number
  uncoveredCount: number
  uncoveredTypes: string[]
  upgradeValue: number
}

/**
 * Obligations a carrier has that their plan does not include: the upsell list for
 * sales, and simultaneously the documented record of what fell outside the agreement.
 */
export async function getCoverageGaps(): Promise<CoverageGapRow[]> {
  return prisma.$queryRaw<CoverageGapRow[]>`
    SELECT
      c.id AS "carrierId", c."dotNumber", c."legalName",
      c.tier::text AS tier,
      COALESCE(fleet.truck_count, 0)::int AS "truckCount",
      COUNT(o.id)::int AS "uncoveredCount",
      ARRAY_AGG(DISTINCT o.type::text) AS "uncoveredTypes",
      (CASE c.tier
         WHEN 'SILVER' THEN ${TIER_ANNUAL_PRICE.DIAMOND - TIER_ANNUAL_PRICE.SILVER}
         WHEN 'GOLD'   THEN ${TIER_ANNUAL_PRICE.DIAMOND - TIER_ANNUAL_PRICE.GOLD}
         ELSE 0
       END) * GREATEST(COALESCE(fleet.truck_count, 1), 1) AS "upgradeValue"
    FROM "Obligation" o
    JOIN "Carrier" c ON c.id = o."carrierId"
    ${FLEET_JOIN}
    WHERE o."coveredByTier" = false
      AND o.status <> 'COMPLETED'
      AND o."dueOn" <= CURRENT_DATE + INTERVAL '365 days'
    GROUP BY c.id, c."dotNumber", c."legalName", c.tier, fleet.truck_count
    ORDER BY "upgradeValue" DESC, "uncoveredCount" DESC
  `
}

// --- 5. seasonal volume ------------------------------------------------------

export interface MonthVolumeRow {
  month: Date
  total: number
  ifta: number
  hvut: number
  ucr: number
  irp: number
  ctc: number
  other: number
}

/** Monthly filing volume — the seasonal wave, straight out of a date_trunc rollup. */
export async function getMonthlyVolume(): Promise<MonthVolumeRow[]> {
  return prisma.$queryRaw<MonthVolumeRow[]>`
    SELECT
      DATE_TRUNC('month', "dueOn")::date AS month,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE type = 'IFTA_QUARTERLY_RETURN')::int  AS ifta,
      COUNT(*) FILTER (WHERE type = 'HVUT_FORM_2290')::int         AS hvut,
      COUNT(*) FILTER (WHERE type = 'UCR_RENEWAL')::int            AS ucr,
      COUNT(*) FILTER (WHERE type = 'IRP_RENEWAL')::int            AS irp,
      COUNT(*) FILTER (WHERE type = 'CARB_CLEAN_TRUCK_CHECK')::int AS ctc,
      COUNT(*) FILTER (WHERE type NOT IN (
        'IFTA_QUARTERLY_RETURN','HVUT_FORM_2290','UCR_RENEWAL','IRP_RENEWAL','CARB_CLEAN_TRUCK_CHECK'
      ))::int AS other
    FROM "Obligation"
    WHERE "dueOn" >= DATE_TRUNC('month', CURRENT_DATE)
      AND "dueOn" <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '12 months'
    GROUP BY 1
    ORDER BY 1
  `
}

// --- 6. relational reads (Prisma) -------------------------------------------

export async function getCarrierByDot(dotNumber: string) {
  return prisma.carrier.findUnique({
    where: { dotNumber },
    include: {
      trucks: { orderBy: { unitNumber: 'asc' } },
      drivers: { orderBy: { lastName: 'asc' } },
      credentials: true,
      obligations: {
        orderBy: { dueOn: 'asc' },
        include: {
          truck: true,
          driver: true,
          blockedBy: { include: { blocker: { include: { truck: true } } } },
          filings: true,
        },
      },
    },
  })
}

export async function getTruckByVin(vin: string) {
  return prisma.truck.findUnique({
    where: { vin },
    include: {
      carrier: true,
      credentials: true,
      obligations: {
        orderBy: { dueOn: 'asc' },
        include: {
          blockedBy: { include: { blocker: true } },
          blocking: { include: { blocked: true } },
          filings: true,
        },
      },
    },
  })
}

export type ObligationStatusFilter = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED'

export interface DeadlineFilters {
  types?: ObligationType[]
  statuses?: ObligationStatusFilter[]
  states?: string[]
  /** Carrier USDOT numbers. */
  carriers?: string[]
  uncoveredOnly?: boolean
  blockedOnly?: boolean
}

export type DeadlineSort = 'carrier' | 'type' | 'period' | 'due' | 'status'

function deadlineWhere(filters: DeadlineFilters): Prisma.ObligationWhereInput {
  const { types, statuses, states, carriers } = filters

  // State and carrier both constrain the same relation, so they must be merged into
  // one `carrier` clause — spreading two would silently drop the first.
  const carrierWhere: Prisma.CarrierWhereInput = {}
  if (states?.length) carrierWhere.state = { in: states }
  if (carriers?.length) carrierWhere.dotNumber = { in: carriers }

  return {
    ...(types?.length ? { type: { in: types } } : {}),
    // With no explicit status chosen, completed filings are hidden — the default
    // question this page answers is "what is still outstanding".
    ...(statuses?.length ? { status: { in: statuses } } : { status: { not: 'COMPLETED' } }),
    ...(filters.uncoveredOnly ? { coveredByTier: false } : {}),
    ...(Object.keys(carrierWhere).length > 0 ? { carrier: carrierWhere } : {}),
    ...(filters.blockedOnly
      ? { blockedBy: { some: { blocker: { status: { not: 'COMPLETED' } } } } }
      : {}),
  }
}

/**
 * Sort order, with a deadline tiebreak on every column.
 *
 * Without a secondary key, rows sharing a value (every obligation of the same type,
 * say) come back in whatever order the planner chooses, which reshuffles between
 * requests and makes the table feel unstable.
 */
function deadlineOrderBy(
  sort: DeadlineSort,
  dir: 'asc' | 'desc',
): Prisma.ObligationOrderByWithRelationInput[] {
  switch (sort) {
    case 'carrier':
      return [{ carrier: { legalName: dir } }, { dueOn: 'asc' }]
    case 'type':
      return [{ type: dir }, { dueOn: 'asc' }]
    case 'period':
      return [{ periodLabel: dir }, { dueOn: 'asc' }]
    case 'status':
      return [{ status: dir }, { dueOn: 'asc' }]
    case 'due':
    default:
      return [{ dueOn: dir }, { id: 'asc' }]
  }
}

/** Total matching the filters, so a truncated page can say so rather than implying completeness. */
export async function getDeadlineCount(filters: DeadlineFilters): Promise<number> {
  return prisma.obligation.count({ where: deadlineWhere(filters) })
}

export async function getDeadlines(
  filters: DeadlineFilters,
  sort: DeadlineSort = 'due',
  dir: 'asc' | 'desc' = 'asc',
  limit = 200,
) {
  return prisma.obligation.findMany({
    where: deadlineWhere(filters),
    orderBy: deadlineOrderBy(sort, dir),
    include: {
      carrier: true,
      truck: true,
      driver: true,
      blockedBy: { include: { blocker: true } },
    },
    take: limit,
  })
}

export async function getStatesInBook(): Promise<string[]> {
  const rows = await prisma.carrier.findMany({
    select: { state: true },
    distinct: ['state'],
    orderBy: { state: 'asc' },
  })
  return rows.map((r) => r.state)
}

/** Carrier options for the filter, keyed by USDOT number so the URL stays readable. */
export async function getCarriersInBook(): Promise<Array<{ dotNumber: string; legalName: string }>> {
  return prisma.carrier.findMany({
    select: { dotNumber: true, legalName: true },
    orderBy: { legalName: 'asc' },
  })
}

export async function getLastRecompute() {
  return prisma.recomputeRun.findFirst({ orderBy: { startedAt: 'desc' } })
}

// --- 7. client portal --------------------------------------------------------

/** Look up a carrier by its opaque portal token. No login; the token is the credential. */
export async function getCarrierByToken(token: string) {
  return prisma.carrier.findUnique({
    where: { portalToken: token },
    include: {
      trucks: { where: { retiredAt: null }, orderBy: { unitNumber: 'asc' } },
      drivers: { where: { terminatedAt: null }, orderBy: { lastName: 'asc' } },
      obligations: {
        orderBy: { dueOn: 'asc' },
        include: { truck: true, driver: true },
      },
      documents: { orderBy: { requestedAt: 'desc' } },
    },
  })
}

// --- 8. document requests ----------------------------------------------------

export async function getOutstandingRequests() {
  return prisma.document.findMany({
    where: { status: 'REQUESTED' },
    include: {
      carrier: true,
      credential: { include: { truck: true, driver: true } },
    },
    orderBy: { expiresOn: 'asc' },
  })
}

export interface RequestSummary {
  outstanding: number
  received: number
  expiringUnrequested: number
  medianDaysToReturn: number | null
}

export async function getRequestSummary(): Promise<RequestSummary> {
  const [row] = await prisma.$queryRaw<
    Array<{
      outstanding: number
      received: number
      expiringUnrequested: number
      medianDaysToReturn: number | null
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE status = 'REQUESTED')::int AS outstanding,
      COUNT(*) FILTER (WHERE status = 'RECEIVED')::int  AS received,
      (SELECT COUNT(*)::int
         FROM "Credential" c
        WHERE c."expiresOn" IS NOT NULL
          AND c."expiresOn" <= CURRENT_DATE + INTERVAL '60 days'
          AND NOT EXISTS (SELECT 1 FROM "Document" d WHERE d."credentialId" = c.id)
      ) AS "expiringUnrequested",
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM ("uploadedAt" - "requestedAt")) / 86400
      ) FILTER (WHERE "uploadedAt" IS NOT NULL) AS "medianDaysToReturn"
    FROM "Document"
  `
  return row
}

// --- 9. planning -------------------------------------------------------------

export interface PlannableObligation {
  id: string
  type: ObligationType
  carrierId: string
  dueOn: Date
  earliestStart: Date | null
}

/** Open obligations in the projection window, with the earliest date work may begin. */
export async function getPlannableObligations(): Promise<PlannableObligation[]> {
  return prisma.$queryRaw<PlannableObligation[]>`
    SELECT id, type::text AS type, "carrierId", "dueOn", "earliestStart"
    FROM "Obligation"
    WHERE status <> 'COMPLETED'
      AND "dueOn" >= DATE_TRUNC('month', CURRENT_DATE)
      AND "dueOn" <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '12 months'
    ORDER BY "dueOn"
  `
}

export interface MonthTypeCount {
  month: Date
  type: ObligationType
  count: number
}

/** Monthly volume split by type — the input to the capacity model. */
export async function getMonthlyTypeCounts(): Promise<MonthTypeCount[]> {
  return prisma.$queryRaw<MonthTypeCount[]>`
    SELECT DATE_TRUNC('month', "dueOn")::date AS month,
           type::text AS type,
           COUNT(*)::int AS count
    FROM "Obligation"
    WHERE status <> 'COMPLETED'
      AND "dueOn" >= DATE_TRUNC('month', CURRENT_DATE)
      AND "dueOn" <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '12 months'
    GROUP BY 1, 2
    ORDER BY 1, 2
  `
}

// --- 10. filing history ------------------------------------------------------

export async function getFilingHistory(carrierId: string) {
  return prisma.filing.findMany({
    where: { obligation: { carrierId } },
    include: { obligation: { include: { truck: true, driver: true } } },
    orderBy: { submittedAt: 'desc' },
  })
}

/** One obligation with everything needed to assemble a filing packet. */
export async function getObligationForPacket(id: string) {
  return prisma.obligation.findUnique({
    where: { id },
    include: {
      carrier: { include: { credentials: true } },
      truck: { include: { credentials: true } },
      driver: { include: { credentials: true } },
      blockedBy: { include: { blocker: true } },
    },
  })
}
