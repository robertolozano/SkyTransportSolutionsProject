'use server'

import { randomBytes } from 'node:crypto'
import { prisma } from '@/server/db'
import {
  recommendPackage,
  recommendTier,
  requirementsFor,
  type OperationProfile,
} from '@/rules/requirements'

/**
 * Prospect capture.
 *
 * This is the one write in the app that happens with no authentication at all,
 * and that is correct: the person filling it in is not a customer yet, so there
 * is nothing to authenticate them against. An account is the *output* of this
 * flow, not a precondition for it.
 *
 * What it creates is a PROSPECT — a carrier record with answers and a
 * recommendation, but no fleet, no credentials, and no obligations. It appears in
 * the staff console as a lead rather than as a compliance liability.
 */

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Unguessable portal token, from a CSPRNG rather than Math.random. */
function portalToken(): string {
  const bytes = randomBytes(22)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export interface ProspectContact {
  legalName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  /** Many new carriers do not have one yet — that is the point of the $475 package. */
  dotNumber?: string
  state: string
}

export interface StartResult {
  ok: boolean
  token?: string
  message?: string
}

export async function createProspect(
  profile: OperationProfile,
  contact: ProspectContact,
): Promise<StartResult> {
  const legalName = contact.legalName?.trim()
  const contactName = contact.contactName?.trim()
  const contactEmail = contact.contactEmail?.trim()

  if (!legalName) return { ok: false, message: 'Please enter your company name.' }
  if (!contactName) return { ok: false, message: 'Please enter your name.' }
  if (!contactEmail || !contactEmail.includes('@')) {
    return { ok: false, message: 'Please enter a valid email address.' }
  }

  const submittedDot = contact.dotNumber?.trim().replace(/\D/g, '')

  if (submittedDot) {
    const existing = await prisma.carrier.findUnique({ where: { dotNumber: submittedDot } })
    if (existing) {
      return {
        ok: false,
        message:
          'We already have an account for that USDOT number. Call us on (800) 498-9820 and we will get you into it.',
      }
    }
  }

  const pkg = recommendPackage(profile)
  const tier = recommendTier(profile)
  const token = portalToken()

  // A carrier without a USDOT number is a real and common case — a brand-new
  // company applying for authority. `dotNumber` is the routing key across the
  // staff console, so a placeholder keeps every existing screen working, and the
  // UI renders it as "not yet issued" rather than as a number.
  const dotNumber = submittedDot || `PENDING-${token.slice(0, 8)}`

  const carrier = await prisma.carrier.create({
    data: {
      dotNumber,
      portalToken: token,
      legalName,
      ein: '',
      addressLine: '',
      city: '',
      state: contact.state,
      zip: '',
      baseState: contact.state,
      operationType: profile.interstate ? 'INTERSTATE' : 'INTRASTATE',
      forHire: profile.forHire,
      hazmat: profile.hazmat,
      tier,
      memberSince: new Date(),
      status: 'PROSPECT',
      contactName,
      contactEmail,
      contactPhone: contact.contactPhone?.trim() || null,
      onboardingProfile: profile as unknown as object,
      recommendedPackage: pkg.name,
      recommendedPrice: pkg.price,
      recommendedTier: tier,
    },
  })

  return { ok: true, token: carrier.portalToken! }
}

/** The requirement list for a stored prospect, recomputed from their answers. */
export async function requirementsForToken(token: string) {
  const carrier = await prisma.carrier.findUnique({ where: { portalToken: token } })
  if (!carrier?.onboardingProfile) return null

  const profile = carrier.onboardingProfile as unknown as OperationProfile
  return {
    carrier,
    profile,
    requirements: requirementsFor(profile),
    pkg: recommendPackage(profile),
    tier: recommendTier(profile),
  }
}
