/**
 * Historical backfill.
 *
 * The engine projects obligations backwards as well as forwards, so a freshly seeded
 * database shows a year of unfiled history — which would imply Sky Transport Solutions
 * never filed anything. This marks past obligations as completed with filing records,
 * leaving a deliberate minority genuinely missed so the real problems stand out
 * against a functioning book of business.
 *
 * Completion survives recomputation: the materializer matches on the natural key.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** This account is deliberately left in a bad state to demonstrate overdue handling. */
const CHRONIC_LATE_DOT = '2870349'

/** Share of past obligations that were filed on time by staff. */
const ON_TIME_RATE = 0.93

const AGENCY_BY_TYPE: Record<string, string> = {
  MCS150_BIENNIAL_UPDATE: 'FMCSA',
  IFTA_QUARTERLY_RETURN: 'CA CDTFA (IFTA base jurisdiction)',
  HVUT_FORM_2290: 'IRS',
  CARB_CLEAN_TRUCK_CHECK: 'CARB',
  IRP_RENEWAL: 'CA DMV',
  UCR_RENEWAL: 'UCR Plan',
  MEDICAL_CARD_RENEWAL: 'Certified Medical Examiner',
}

const STAFF = ['k.alvarez', 'w.moran', 'd.chen', 'r.batista', 's.okafor']

function mulberry32(seed: number) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(70141)

async function main() {
  const today = new Date()
  const chronic = await prisma.carrier.findUnique({ where: { dotNumber: CHRONIC_LATE_DOT } })

  const past = await prisma.obligation.findMany({
    where: { dueOn: { lt: today }, completedAt: null },
    select: { id: true, type: true, dueOn: true, carrierId: true },
  })

  let completed = 0
  let leftOverdue = 0

  for (const o of past) {
    // The chronic-late account keeps most of its misses.
    const isChronic = chronic && o.carrierId === chronic.id
    const filed = isChronic ? rand() < 0.35 : rand() < ON_TIME_RATE

    if (!filed) {
      leftOverdue++
      continue
    }

    // Filed somewhere between three weeks early and the deadline itself.
    const submittedAt = new Date(o.dueOn)
    submittedAt.setUTCDate(submittedAt.getUTCDate() - Math.floor(rand() * 21))

    await prisma.obligation.update({
      where: { id: o.id },
      data: { status: 'COMPLETED', completedAt: submittedAt },
    })
    await prisma.filing.create({
      data: {
        obligationId: o.id,
        agency: AGENCY_BY_TYPE[o.type] ?? 'Agency',
        submittedAt,
        submittedBy: STAFF[Math.floor(rand() * STAFF.length)],
        confirmationRef: `${o.type.slice(0, 4)}-${Math.floor(rand() * 900000 + 100000)}`,
      },
    })
    completed++
  }

  console.log(`Backfill complete: ${completed} filed, ${leftOverdue} left genuinely overdue.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
