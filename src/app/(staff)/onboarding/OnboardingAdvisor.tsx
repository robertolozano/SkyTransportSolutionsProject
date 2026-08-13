'use client'

import { useState } from 'react'
import {
  DEFAULT_PROFILE,
  recommendPackage,
  recommendTier,
  requirementsFor,
  type OperationProfile,
} from '@/rules/requirements'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'
import { money } from '@/components/ui'

const QUESTIONS: Array<{
  key: keyof OperationProfile
  question: string
  detail: string
}> = [
  {
    key: 'forHire',
    question: 'Hauling freight for other people, for pay?',
    detail: 'Carrying only your own company\'s goods is a different regulatory category.',
  },
  {
    key: 'interstate',
    question: 'Crossing state lines?',
    detail: 'Interstate operation triggers federal authority, fuel tax, and annual federal registration.',
  },
  {
    key: 'heavyVehicle',
    question: 'Any vehicle at 55,000 lbs or more?',
    detail: 'This is the threshold for the federal heavy vehicle use tax.',
  },
  {
    key: 'california',
    question: 'Operating in California?',
    detail: 'California adds emissions compliance and, for intrastate carriers, its own permit.',
  },
  { key: 'hazmat', question: 'Carrying placarded hazardous materials?', detail: 'Adds separate federal registration.' },
  { key: 'needsEntity', question: 'Need the business entity formed?', detail: 'LLC or corporation, plus federal tax identification.' },
]

export function OnboardingAdvisor() {
  const [profile, setProfile] = useState<OperationProfile>(DEFAULT_PROFILE)

  const requirements = requirementsFor(profile)
  const pkg = recommendPackage(profile)
  const tier = recommendTier(profile)
  const annual = TIER_ANNUAL_PRICE[tier] * Math.max(1, profile.fleetSize)

  const toggle = (key: keyof OperationProfile) =>
    setProfile((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Questions */}
      <div className="space-y-2.5">
        {QUESTIONS.map((q) => {
          const value = Boolean(profile[q.key])
          return (
            <button
              key={q.key}
              onClick={() => toggle(q.key)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                value
                  ? 'border-brand bg-brand-soft'
                  : 'border-edge bg-surface hover:border-edge-strong'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{q.question}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-ink-faint">{q.detail}</div>
                </div>
                <span
                  className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                    value
                      ? 'border-brand bg-surface text-brand'
                      : 'border-edge-strong bg-canvas text-ink-faint'
                  }`}
                >
                  {value ? 'Yes' : 'No'}
                </span>
              </div>
            </button>
          )
        })}

        <div className="rounded-lg border border-edge bg-surface px-4 py-3">
          <label className="text-[13px] font-medium text-ink" htmlFor="fleet">
            How many trucks?
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="fleet"
              type="range"
              min={1}
              max={25}
              value={profile.fleetSize}
              onChange={(e) => setProfile((p) => ({ ...p, fleetSize: Number(e.target.value) }))}
              className="flex-1 accent-[color:var(--color-brand)]"
            />
            <span className="numeric w-8 text-[13px] font-medium text-ink">
              {profile.fleetSize}
            </span>
          </div>
        </div>
      </div>

      {/* Answer */}
      <div className="space-y-5">
        <div className="rounded-lg border border-edge bg-surface px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Recommended setup
              </div>
              <div className="mt-1 text-lg font-semibold text-ink">{pkg.name}</div>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-soft">
                {pkg.rationale}
              </p>
            </div>
            <div className="text-right">
              <div className="numeric text-2xl font-semibold text-ink">{money(pkg.price)}</div>
              <div className="text-[11px] text-ink-faint">one-time</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-3.5">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Ongoing membership
              </div>
              <div className="mt-1 text-[13px] text-ink-soft">
                {tier.charAt(0)}
                {tier.slice(1).toLowerCase()} covers the renewals this operation generates.
              </div>
            </div>
            <div className="text-right">
              <div className="numeric text-lg font-semibold text-ink">{money(annual)}</div>
              <div className="text-[11px] text-ink-faint">
                per year · {money(TIER_ANNUAL_PRICE[tier])} × {profile.fleetSize} truck
                {profile.fleetSize === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              What is required — in order
            </h2>
            <span className="numeric text-[13px] text-ink-faint">
              {requirements.length} credentials
            </span>
          </div>

          <ol className="space-y-2">
            {requirements.map((r, i) => (
              <li key={r.key} className="rounded-lg border border-edge bg-surface px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="numeric mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-medium text-ink-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{r.name}</span>
                      <span className="text-[11px] text-ink-faint">{r.citation}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{r.why}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
                      {r.prerequisites.length > 0 && (
                        <span>
                          Requires first:{' '}
                          <span className="text-ink-soft">{r.prerequisites.join(', ')}</span>
                        </span>
                      )}
                      {r.recurring && (
                        <span>
                          Then recurring: <span className="text-ink-soft">{r.recurring}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
