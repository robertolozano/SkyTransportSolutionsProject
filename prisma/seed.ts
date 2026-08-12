/**
 * Seed data.
 *
 * Two goals, in tension:
 *   1. Enough volume that the dashboard looks like a real book of business.
 *   2. A handful of hand-tuned accounts that demonstrate specific failure modes,
 *      placed at known distances from today so the demo is legible.
 *
 * Randomised fields use a fixed-seed PRNG so the shape of the data is reproducible
 * across resets, while deadlines are anchored relative to the current date so the
 * app always looks live.
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { gateEdges } from '../src/rules'

const prisma = new PrismaClient()

// --- deterministic randomness ------------------------------------------------

function mulberry32(seed: number) {
  return function rand() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260812)

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

// --- date helpers ------------------------------------------------------------

const TODAY = new Date()
const today = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()))

function daysFromToday(days: number): Date {
  const d = new Date(today.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

// --- vocabulary --------------------------------------------------------------

const FIRST = ['Miguel', 'Jasbir', 'Andre', 'Tomas', 'Ray', 'Hector', 'Dmitri', 'Samuel', 'Luis', 'Kenji', 'Marcus', 'Ravi', 'Ivan', 'Oscar', 'Deion', 'Pavel', 'Curtis', 'Amrit', 'Felipe', 'Grant']
const LAST = ['Reyes', 'Singh', 'Whitfield', 'Navarro', 'Boyd', 'Delgado', 'Volkov', 'Osei', 'Marquez', 'Tanaka', 'Ellis', 'Patel', 'Petrov', 'Cardenas', 'Wallace', 'Novak', 'Hensley', 'Gill', 'Ferreira', 'Mueller']

const NAME_A = ['Altamont', 'Delta Valley', 'Golden State', 'Sierra Ridge', 'Tracy', 'Central Valley', 'Pacific Rim', 'Mission Bay', 'Coastal', 'Vallejo', 'Ironwood', 'Redline', 'Summit', 'Blue Diamond', 'Harvest', 'Trans-Sierra', 'Lone Star', 'Rio Grande', 'Cascade', 'Silver Creek', 'Bayline', 'Modesto', 'Stockton', 'San Joaquin', 'Westgate', 'Northstar', 'Cross Roads', 'Empire', 'Vantage', 'Anchor']
const NAME_B = ['Freight Systems', 'Transport', 'Logistics', 'Trucking', 'Carriers', 'Hauling', 'Express', 'Distribution', 'Freight Lines', 'Cartage']
const SUFFIX = ['LLC', 'Inc.', 'LLC', 'Corp.']

const MAKES = ['Freightliner', 'Peterbilt', 'Kenworth', 'Volvo', 'International', 'Mack']

const CA_CITIES: Array<[string, string]> = [
  ['Tracy', '95376'], ['Stockton', '95205'], ['Modesto', '95354'], ['Fresno', '93706'],
  ['Bakersfield', '93301'], ['Sacramento', '95814'], ['Fontana', '92335'], ['Oakland', '94607'],
  ['Manteca', '95336'], ['Lathrop', '95330'],
]
const TX_CITIES: Array<[string, string]> = [
  ['Lewisville', '75057'], ['Dallas', '75201'], ['Houston', '77002'], ['Laredo', '78040'], ['El Paso', '79901'],
]

function vin(i: number): string {
  const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'
  let out = '1FUJ'
  for (let k = 0; k < 12; k++) out += chars[Math.floor(rand() * chars.length)]
  return (out + i).slice(0, 17)
}

// --- carrier construction ----------------------------------------------------

interface CarrierPlan {
  dotNumber: string
  legalName: string
  tier: 'SILVER' | 'GOLD' | 'DIAMOND'
  operationType: 'INTERSTATE' | 'INTRASTATE'
  baseState: string
  truckCount: number
  /** Plate expiry offsets in days from today, one per truck. */
  plateOffsets: number[]
  /** Medical card expiry offsets, one per driver. */
  medicalOffsets: number[]
  note?: string
}

/**
 * Hand-tuned accounts. Each one exists to make a specific behaviour visible in the
 * demo, at a known distance from today.
 */
function showcaseCarriers(): CarrierPlan[] {
  return [
    {
      // THE HERO CASE. Plate expires in 35 days, which pulls the emissions deadline
      // to 5 days out and puts the tax filing in between. Three-step chain, and the
      // carrier is on Silver so the plate renewal is not even covered by their plan.
      dotNumber: '3421569',
      legalName: 'Altamont Freight Systems LLC',
      tier: 'SILVER',
      operationType: 'INTERSTATE',
      baseState: 'CA',
      truckCount: 3,
      plateOffsets: [35, 96, 210],
      medicalOffsets: [44, 180, 320],
      note: 'Chain demo: emissions -> tax filing -> plate renewal, on an uncovered tier.',
    },
    {
      // Already past a deadline nobody was tracking.
      dotNumber: '2870349',
      legalName: 'Delta Valley Transport Inc.',
      tier: 'GOLD',
      operationType: 'INTERSTATE',
      baseState: 'CA',
      truckCount: 5,
      plateOffsets: [-12, 62, 140, 220, 300],
      medicalOffsets: [-5, 90, 150, 260, 340],
      note: 'Already overdue: expired plate and a lapsed medical certificate.',
    },
    {
      // Large fleet on the lowest tier: the biggest upsell in the book.
      dotNumber: '1938471',
      legalName: 'Central Valley Carriers LLC',
      tier: 'SILVER',
      operationType: 'INTERSTATE',
      baseState: 'CA',
      truckCount: 12,
      plateOffsets: [48, 71, 88, 119, 133, 152, 168, 194, 226, 251, 288, 305],
      medicalOffsets: [30, 61, 95, 128, 160, 190, 221, 255, 288, 310, 330, 355],
      note: 'Tier gap demo: twelve trucks on Silver, with fuel tax and plate renewals uncovered.',
    },
    {
      // Intrastate-only: proves the engine suppresses federal interstate obligations.
      dotNumber: '4102285',
      legalName: 'Mission Bay Hauling LLC',
      tier: 'GOLD',
      operationType: 'INTRASTATE',
      baseState: 'CA',
      truckCount: 2,
      plateOffsets: [77, 195],
      medicalOffsets: [110, 240],
      note: 'Intrastate: no fuel tax return, no annual federal registration.',
    },
    {
      // Out of state: California emissions rules must NOT fire here.
      dotNumber: '3655128',
      legalName: 'Lone Star Distribution Inc.',
      tier: 'DIAMOND',
      operationType: 'INTERSTATE',
      baseState: 'TX',
      truckCount: 6,
      plateOffsets: [40, 85, 128, 173, 244, 299],
      medicalOffsets: [55, 99, 142, 200, 265, 318],
      note: 'Out-of-state control: emissions rule correctly does not apply.',
    },
  ]
}

function generatedCarriers(count: number): CarrierPlan[] {
  const out: CarrierPlan[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    let legalName = ''
    do {
      legalName = `${pick(NAME_A)} ${pick(NAME_B)} ${pick(SUFFIX)}`
    } while (usedNames.has(legalName))
    usedNames.add(legalName)

    // Owner-operators dominate the book, with a tail of small fleets.
    const truckCount = rand() < 0.45 ? 1 : rand() < 0.8 ? randInt(2, 5) : randInt(6, 14)
    const driverCount = Math.max(1, truckCount + (rand() < 0.3 ? 1 : 0))

    out.push({
      dotNumber: String(1_000_000 + 13_477 * (i + 7) + randInt(0, 900)),
      legalName,
      tier: rand() < 0.5 ? 'SILVER' : rand() < 0.8 ? 'GOLD' : 'DIAMOND',
      operationType: rand() < 0.82 ? 'INTERSTATE' : 'INTRASTATE',
      baseState: rand() < 0.72 ? 'CA' : pick(['TX', 'NV', 'AZ', 'OR']),
      truckCount,
      plateOffsets: Array.from({ length: truckCount }, () => randInt(-20, 350)),
      medicalOffsets: Array.from({ length: driverCount }, () => randInt(-15, 360)),
    })
  }
  return out
}

// --- main --------------------------------------------------------------------

async function main() {
  console.log('Clearing existing data...')
  await prisma.obligationBlock.deleteMany()
  await prisma.filing.deleteMany()
  await prisma.obligation.deleteMany()
  await prisma.document.deleteMany()
  await prisma.credential.deleteMany()
  await prisma.truck.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.carrier.deleteMany()
  await prisma.obligationGate.deleteMany()
  await prisma.recomputeRun.deleteMany()

  // Project the type-level dependency graph out of the rules module.
  console.log('Writing dependency gates...')
  const edges = gateEdges()
  await prisma.obligationGate.createMany({
    data: edges.map((e) => ({
      blockerType: e.blockerType,
      blockedType: e.blockedType,
      reason: e.reason,
      citation: e.citation,
    })),
  })

  const plans = [...showcaseCarriers(), ...generatedCarriers(35)]
  const seenDot = new Set<string>()
  let truckSeq = 0

  console.log(`Creating ${plans.length} carriers...`)
  for (const plan of plans) {
    if (seenDot.has(plan.dotNumber)) continue
    seenDot.add(plan.dotNumber)

    const cities = plan.baseState === 'TX' ? TX_CITIES : CA_CITIES
    const [city, zip] = pick(cities)

    const truckData: Prisma.TruckCreateWithoutCarrierInput[] = plan.plateOffsets.map((_, idx) => ({
      vin: vin(truckSeq++),
      unitNumber: String(101 + idx),
      year: randInt(2015, 2024),
      make: pick(MAKES),
      // A few light vehicles so the weight threshold visibly excludes something.
      grossWeightLbs: rand() < 0.12 ? randInt(26_000, 52_000) : randInt(60_000, 80_000),
      plateState: plan.baseState,
    }))

    const driverData: Prisma.DriverCreateWithoutCarrierInput[] = plan.medicalOffsets.map(() => ({
      firstName: pick(FIRST),
      lastName: pick(LAST),
      cdlNumber: `${plan.baseState}${randInt(1_000_000, 9_999_999)}`,
      cdlState: plan.baseState,
      hireDate: daysFromToday(-randInt(120, 2200)),
    }))

    const carrier = await prisma.carrier.create({
      data: {
        dotNumber: plan.dotNumber,
        mcNumber: plan.operationType === 'INTERSTATE' ? `MC${randInt(200_000, 999_999)}` : null,
        legalName: plan.legalName,
        ein: `${randInt(10, 99)}-${randInt(1_000_000, 9_999_999)}`,
        addressLine: `${randInt(100, 9999)} ${pick(['Industrial', 'Commerce', 'Railroad', 'Sperry', 'Chrisman', 'Grant Line'])} ${pick(['Rd', 'Ave', 'St', 'Way'])}`,
        city,
        state: plan.baseState,
        zip,
        baseState: plan.baseState,
        operationType: plan.operationType,
        forHire: true,
        hazmat: rand() < 0.15,
        tier: plan.tier,
        memberSince: daysFromToday(-randInt(200, 3600)),
        trucks: { create: truckData },
        drivers: { create: driverData },
      },
      include: { trucks: true, drivers: true },
    })

    // Carrier-level credentials.
    const carrierCreds: Prisma.CredentialCreateManyInput[] = [
      { carrierId: carrier.id, type: 'USDOT_REGISTRATION', identifier: plan.dotNumber, status: 'ACTIVE' },
      { carrierId: carrier.id, type: 'INSURANCE', status: 'ACTIVE', expiresOn: daysFromToday(randInt(30, 340)) },
    ]
    if (plan.operationType === 'INTERSTATE') {
      carrierCreds.push(
        { carrierId: carrier.id, type: 'MC_AUTHORITY', identifier: carrier.mcNumber ?? undefined, status: 'ACTIVE' },
        { carrierId: carrier.id, type: 'IFTA_LICENSE', status: 'ACTIVE', expiresOn: daysFromToday(randInt(60, 360)) },
        { carrierId: carrier.id, type: 'UCR_REGISTRATION', status: 'ACTIVE', expiresOn: daysFromToday(randInt(20, 300)) },
        { carrierId: carrier.id, type: 'PROCESS_AGENT', status: 'ACTIVE' },
      )
    }
    if (plan.baseState === 'CA' && plan.operationType === 'INTRASTATE') {
      carrierCreds.push({ carrierId: carrier.id, type: 'CA_MCP', status: 'ACTIVE', expiresOn: daysFromToday(randInt(40, 330)) })
    }

    // Truck-level: the apportioned plate is what everything else hangs off.
    const truckCreds: Prisma.CredentialCreateManyInput[] = carrier.trucks.flatMap((truck, idx) => {
      const offset = plan.plateOffsets[idx] ?? randInt(30, 340)
      const expiry = daysFromToday(offset)
      const creds: Prisma.CredentialCreateManyInput[] = [
        {
          carrierId: carrier.id,
          truckId: truck.id,
          type: 'IRP_PLATE',
          identifier: `${plan.baseState}-${randInt(100_000, 999_999)}`,
          issuedOn: daysFromToday(offset - 365),
          expiresOn: expiry,
          status: offset < 0 ? 'EXPIRED' : offset < 45 ? 'EXPIRING' : 'ACTIVE',
        },
      ]
      // Most fleets have last year's tax receipt on file; some do not.
      if (rand() < 0.7) {
        creds.push({
          carrierId: carrier.id,
          truckId: truck.id,
          type: 'HVUT_RECEIPT',
          identifier: `SCH1-${randInt(100_000, 999_999)}`,
          issuedOn: daysFromToday(-randInt(200, 400)),
          status: 'ACTIVE',
        })
      }
      return creds
    })

    const driverCreds: Prisma.CredentialCreateManyInput[] = carrier.drivers.flatMap((driver, idx) => {
      const offset = plan.medicalOffsets[idx] ?? randInt(30, 340)
      return [
        {
          carrierId: carrier.id,
          driverId: driver.id,
          type: 'MEDICAL_CARD',
          issuedOn: daysFromToday(offset - 730),
          expiresOn: daysFromToday(offset),
          status: offset < 0 ? 'EXPIRED' : offset < 45 ? 'EXPIRING' : 'ACTIVE',
        },
        {
          carrierId: carrier.id,
          driverId: driver.id,
          type: 'CDL',
          identifier: driver.cdlNumber,
          expiresOn: daysFromToday(randInt(120, 1400)),
          status: 'ACTIVE',
        },
      ]
    })

    await prisma.credential.createMany({ data: [...carrierCreds, ...truckCreds, ...driverCreds] })
  }

  const counts = {
    carriers: await prisma.carrier.count(),
    trucks: await prisma.truck.count(),
    drivers: await prisma.driver.count(),
    credentials: await prisma.credential.count(),
    gates: await prisma.obligationGate.count(),
  }
  console.log('Seed complete:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
