/**
 * Requirement advisor — the rules engine run forward.
 *
 * The deadline engine answers "when is this due?" for a carrier that already exists.
 * This answers the question that comes first: "what do I actually need?" Both read
 * from the same domain model, which is why flipping one answer here visibly changes
 * the obligations that would later be derived.
 */

export interface OperationProfile {
  /** Hauling other people's freight for pay, rather than the company's own goods. */
  forHire: boolean
  /** Crossing state lines. */
  interstate: boolean
  /** Any vehicle at or above 55,000 lbs taxable gross weight. */
  heavyVehicle: boolean
  /** Operating in California. */
  california: boolean
  hazmat: boolean
  /** Needs a business entity formed. */
  needsEntity: boolean
  fleetSize: number
}

export interface Requirement {
  key: string
  name: string
  why: string
  citation: string
  /** Requirement keys that must be in place before this one can be obtained. */
  prerequisites: string[]
  recurring: string | null
}

export const DEFAULT_PROFILE: OperationProfile = {
  forHire: true,
  interstate: true,
  heavyVehicle: true,
  california: true,
  hazmat: false,
  needsEntity: false,
  fleetSize: 1,
}

export function requirementsFor(p: OperationProfile): Requirement[] {
  const out: Requirement[] = []

  if (p.needsEntity) {
    out.push({
      key: 'ENTITY',
      name: 'Business entity + EIN',
      why: 'A registered entity and federal tax identification number are needed before any operating credential can be issued in the business name.',
      citation: 'CA Secretary of State; IRS Form SS-4',
      prerequisites: [],
      recurring: 'Annual/biennial statement of information',
    })
  }

  out.push({
    key: 'USDOT',
    name: 'USDOT number',
    why: 'Identifies the carrier in the federal safety system. Required for commercial vehicles in interstate commerce, and separately required by California for intrastate carriers.',
    citation: '49 CFR 390.19',
    prerequisites: p.needsEntity ? ['ENTITY'] : [],
    recurring: 'MCS-150 biennial update',
  })

  if (p.interstate && p.forHire) {
    out.push({
      key: 'INSURANCE',
      name: 'Insurance filing (BMC-91/91X)',
      why: 'The insurer files proof of liability coverage directly with FMCSA. Operating authority will not be granted, and is revoked, without it on file.',
      citation: '49 CFR 387',
      prerequisites: ['USDOT'],
      recurring: 'Continuous — a lapse revokes authority',
    })
    out.push({
      key: 'BOC3',
      name: 'BOC-3 process agents',
      why: 'Designates a representative in every state who can accept legal service on the carrier\'s behalf. Authority cannot be granted until it is filed.',
      citation: '49 CFR 366',
      prerequisites: ['USDOT'],
      recurring: 'One-time, unless agents change',
    })
    out.push({
      key: 'MC',
      name: 'MC operating authority',
      why: 'Permission to transport regulated commodities for compensation across state lines. Not required when hauling only the company\'s own goods.',
      citation: '49 CFR 365',
      prerequisites: ['INSURANCE', 'BOC3'],
      recurring: 'Maintained by insurance and biennial update',
    })
    out.push({
      key: 'UCR',
      name: 'Unified Carrier Registration',
      why: 'Annual federal fee for interstate carriers, bracketed by fleet size.',
      citation: '49 CFR 367',
      prerequisites: ['USDOT'],
      recurring: 'Annual — opens October 1, due December 31',
    })
    out.push({
      key: 'IFTA',
      name: 'IFTA fuel tax licence',
      why: 'Lets the carrier report fuel tax to a single base jurisdiction rather than to every state it drives through.',
      citation: 'IFTA Articles of Agreement',
      prerequisites: ['USDOT'],
      recurring: 'Quarterly return — Apr 30, Jul 31, Oct 31, Jan 31',
    })
    out.push({
      key: 'IRP',
      name: 'IRP apportioned plates',
      why: 'Single registration valid across member jurisdictions, with fees apportioned by distance travelled in each.',
      citation: 'International Registration Plan',
      prerequisites: p.heavyVehicle ? ['USDOT', 'HVUT'] : ['USDOT'],
      recurring: 'Annual renewal',
    })
  }

  if (!p.interstate && p.california) {
    out.push({
      key: 'CA_MCP',
      name: 'California Motor Carrier Permit',
      why: 'Required to operate commercially within California. Issued by the DMV and tied to Highway Patrol terminal inspection.',
      citation: 'CA Vehicle Code §34620',
      prerequisites: ['USDOT'],
      recurring: 'Annual renewal',
    })
  }

  if (p.heavyVehicle) {
    out.push({
      key: 'HVUT',
      name: 'Form 2290 heavy vehicle use tax',
      why: 'Federal excise tax on vehicles at or above 55,000 lbs. The stamped Schedule 1 returned by the IRS is required before a state will register the vehicle.',
      citation: 'IRS Form 2290; 26 CFR 41.6001-2',
      prerequisites: ['USDOT'],
      recurring: 'Annual — due August 31',
    })
  }

  if (p.california) {
    out.push({
      key: 'CTC',
      name: 'CARB Clean Truck Check',
      why: 'California emissions compliance for heavy-duty vehicles. Non-compliance places a hold on DMV registration.',
      citation: '13 CCR §2196',
      prerequisites: [],
      recurring: 'Periodic testing tied to the registration cycle',
    })
  }

  if (p.hazmat) {
    out.push({
      key: 'HAZMAT',
      name: 'Hazardous materials registration',
      why: 'Separate federal registration and security planning obligations apply to carriers transporting placarded quantities.',
      citation: '49 CFR 107 Subpart G',
      prerequisites: ['USDOT'],
      recurring: 'Annual',
    })
  }

  out.push({
    key: 'DQF',
    name: 'Driver qualification files + drug & alcohol program',
    why: 'Each driver needs a maintained qualification file and enrollment in a random testing pool. These are the records a safety audit asks for first.',
    citation: '49 CFR 391, 49 CFR 382',
    prerequisites: ['USDOT'],
    recurring: 'Annual record review; quarterly random selections',
  })

  return sortByDependency(out)
}

/** Topological order so the list reads as the sequence work must actually happen in. */
function sortByDependency(items: Requirement[]): Requirement[] {
  const byKey = new Map(items.map((r) => [r.key, r]))
  const placed = new Set<string>()
  const out: Requirement[] = []

  const visit = (item: Requirement, guard: Set<string>) => {
    if (placed.has(item.key) || guard.has(item.key)) return
    guard.add(item.key)
    for (const prereq of item.prerequisites) {
      const dep = byKey.get(prereq)
      if (dep) visit(dep, guard)
    }
    placed.add(item.key)
    out.push(item)
  }

  for (const item of items) visit(item, new Set())
  return out
}

// --- packages ---------------------------------------------------------------

export interface PackageRecommendation {
  name: string
  price: number
  rationale: string
}

/** Setup package pricing, per Sky Transport Solutions' published rates. */
export function recommendPackage(p: OperationProfile): PackageRecommendation {
  if (p.interstate && p.forHire) {
    return {
      name: 'Interstate Power Setup',
      price: 1200,
      rationale:
        'For-hire interstate operation requires full authority: USDOT, MC number, insurance filing, process agents, fuel tax licence, and annual federal registration.',
    }
  }
  if (p.california && !p.interstate) {
    return {
      name: 'Local / Intrastate Setup',
      price: 975,
      rationale:
        'California-only operation needs the state motor carrier permit and emissions compliance, but no federal operating authority or fuel tax licence.',
    }
  }
  return {
    name: 'New Corp / LLC Setup',
    price: 475,
    rationale: 'Entity formation, tax identification, and initial filings only.',
  }
}

export const TIER_RECOMMENDATION: Record<string, string> = {
  low: 'Silver — covers the biennial update, state permit, and emissions renewals.',
  mid: 'Gold — adds fuel tax, annual federal registration, and the heavy vehicle tax.',
  high: 'Diamond — adds plate renewals and audit representation.',
}

export function recommendTier(p: OperationProfile): 'SILVER' | 'GOLD' | 'DIAMOND' {
  if (p.interstate && p.fleetSize >= 3) return 'DIAMOND'
  if (p.interstate || p.heavyVehicle) return 'GOLD'
  return 'SILVER'
}
