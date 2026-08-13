/**
 * Document request generation.
 *
 * Runs the pure `documentsToRequest` planner over every credential in the book and
 * writes the resulting requests. In a real deployment this is a scheduled job; here
 * it runs once after seeding.
 *
 * Request timestamps are staggered backwards so the escalation ladder shows every
 * state at once — some requests just sent, some already escalated.
 */
import { PrismaClient } from '@prisma/client'
import { documentsToRequest, type ExpiringCredential } from '../src/rules/chase'

const prisma = new PrismaClient()

function mulberry32(seed: number) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(884412)

/**
 * The showcase carrier always keeps its requests outstanding, so the client
 * portal demonstrates the collection flow rather than an empty state.
 */
const SHOWCASE_DOT = '3421569'

async function main() {
  const asOf = new Date()
  await prisma.document.deleteMany()

  const showcase = await prisma.carrier.findUnique({
    where: { dotNumber: SHOWCASE_DOT },
    select: { id: true },
  })

  const credentials = await prisma.credential.findMany({
    where: { expiresOn: { not: null } },
    select: {
      id: true,
      carrierId: true,
      truckId: true,
      driverId: true,
      type: true,
      expiresOn: true,
    },
  })

  const plans = documentsToRequest(
    credentials.map((c) => ({ ...c, expiresOn: c.expiresOn! }) as ExpiringCredential),
    asOf,
  )

  let requested = 0
  let received = 0

  for (const plan of plans) {
    // Spread the request date backwards so the ladder shows every rung.
    const daysAgo = Math.floor(rand() * 14)
    const requestedAt = new Date(asOf)
    requestedAt.setUTCDate(requestedAt.getUTCDate() - daysAgo)

    // Most clients do eventually send the document — except the showcase account,
    // whose requests stay open so the portal has something to collect.
    const isShowcase = showcase && plan.carrierId === showcase.id
    const hasArrived = isShowcase ? false : rand() < 0.55
    const uploadedAt = hasArrived
      ? new Date(requestedAt.getTime() + Math.floor(rand() * 4 + 1) * 86_400_000)
      : null

    await prisma.document.create({
      data: {
        carrierId: plan.carrierId,
        credentialId: plan.credentialId,
        type: plan.documentType,
        fileName: hasArrived
          ? `${plan.documentType.toLowerCase().replace(/[^a-z]+/g, '-')}.jpg`
          : '',
        storagePath: hasArrived ? `/uploads/${plan.credentialId}.jpg` : '',
        status: hasArrived ? 'RECEIVED' : 'REQUESTED',
        requestedAt,
        uploadedAt,
        expiresOn: plan.expiresOn,
      },
    })

    if (hasArrived) received++
    else requested++
  }

  console.log(`Document requests: ${requested} outstanding, ${received} received.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
