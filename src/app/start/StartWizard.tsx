'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DEFAULT_PROFILE,
  recommendPackage,
  recommendTier,
  requirementsFor,
  type OperationProfile,
} from '@/rules/requirements'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'
import { createProspect } from './actions'

/**
 * Public onboarding walkthrough.
 *
 * The reader is a prospective carrier who has never dealt with Sky before, so
 * the whole point is that the requirement list is *live*: every answer visibly
 * adds or removes obligations, which is the thing a static pricing page can
 * never show. Answering "I only run inside California" should make half the
 * federal requirements disappear in front of them.
 *
 * It runs the same `requirementsFor` engine the staff advisor uses. One rule set,
 * two audiences.
 */

const STATES = [
  'CA', 'TX', 'AZ', 'NV', 'OR', 'WA', 'ID', 'UT', 'CO', 'NM',
  'OK', 'KS', 'MO', 'AR', 'LA', 'IL', 'IN', 'OH', 'MI', 'WI',
  'MN', 'IA', 'NE', 'GA', 'FL', 'NC', 'SC', 'TN', 'AL', 'MS',
  'VA', 'PA', 'NY', 'NJ', 'MA', 'MD', 'KY', 'WV', 'ME', 'MT',
]

interface Question {
  key: keyof OperationProfile
  question: string
  detail: string
  /** Shown when the answer is yes, so the consequence is visible before committing. */
  effect: string
}

const QUESTIONS: Question[] = [
  {
    key: 'forHire',
    question: 'Will you haul freight for other people, for pay?',
    detail: 'Carrying only your own company’s goods is a different category with fewer requirements.',
    effect: 'Requires operating authority, insurance filings, and process agents.',
  },
  {
    key: 'interstate',
    question: 'Will you cross state lines?',
    detail: 'Staying inside one state avoids most federal registration.',
    effect: 'Adds federal authority, fuel tax, apportioned plates, and the annual federal fee.',
  },
  {
    key: 'heavyVehicle',
    question: 'Will any vehicle weigh 55,000 lbs or more?',
    detail: 'This is the federal heavy vehicle use tax threshold.',
    effect: 'Adds the Form 2290 heavy vehicle use tax, which gates your plate renewal.',
  },
  {
    key: 'california',
    question: 'Will you operate in California?',
    detail: 'California has its own emissions and permit rules on top of federal ones.',
    effect: 'Adds Clean Truck Check emissions compliance, which gates DMV registration.',
  },
  {
    key: 'hazmat',
    question: 'Will you carry placarded hazardous materials?',
    detail: 'Only applies to quantities requiring placards.',
    effect: 'Adds federal hazardous materials registration and security planning.',
  },
  {
    key: 'needsEntity',
    question: 'Do you still need the business set up?',
    detail: 'An LLC or corporation, plus a federal tax ID.',
    effect: 'We form the entity and obtain your EIN before anything else can be filed.',
  },
]

export function StartWizard() {
  const router = useRouter()
  const [profile, setProfile] = useState<OperationProfile>(DEFAULT_PROFILE)
  const [showCapture, setShowCapture] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [contact, setContact] = useState({
    legalName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    dotNumber: '',
    state: 'CA',
  })

  const requirements = useMemo(() => requirementsFor(profile), [profile])
  const pkg = useMemo(() => recommendPackage(profile), [profile])
  const tier = useMemo(() => recommendTier(profile), [profile])
  const annual = TIER_ANNUAL_PRICE[tier] * Math.max(1, profile.fleetSize)

  const set = (key: keyof OperationProfile, value: boolean) =>
    setProfile((p) => ({ ...p, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const result = await createProspect(profile, { ...contact, state: contact.state })
    if (!result.ok) {
      setError(result.message ?? 'Something went wrong. Please try again.')
      return
    }
    startTransition(() => router.push(`/start/submitted/${result.token}`))
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Questions */}
      <div>
        <ol className="space-y-3">
          {QUESTIONS.map((q, i) => {
            const value = Boolean(profile[q.key])
            return (
              <li key={q.key} className="rounded-xl border border-edge bg-surface px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="numeric mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-medium text-ink-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-ink">{q.question}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">{q.detail}</p>

                    <div className="mt-3 flex gap-2">
                      <Choice label="Yes" selected={value} onClick={() => set(q.key, true)} />
                      <Choice label="No" selected={!value} onClick={() => set(q.key, false)} />
                    </div>

                    {value && (
                      <p className="mt-2.5 text-[13px] leading-relaxed text-brand">{q.effect}</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}

          <li className="rounded-xl border border-edge bg-surface px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="numeric mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-medium text-ink-soft">
                {QUESTIONS.length + 1}
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="fleet" className="text-[15px] font-medium text-ink">
                  How many trucks will you run?
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <input
                    id="fleet"
                    type="range"
                    min={1}
                    max={25}
                    value={profile.fleetSize}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, fleetSize: Number(e.target.value) }))
                    }
                    className="flex-1 accent-[color:var(--color-brand)]"
                  />
                  <span className="numeric w-8 text-[15px] font-medium text-ink">
                    {profile.fleetSize}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ol>
      </div>

      {/* Live result */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-edge bg-surface">
          <div className="border-b border-edge px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              What you&apos;ll need
            </div>
            <div className="numeric mt-1 text-2xl font-semibold text-ink">
              {requirements.length}{' '}
              <span className="text-[15px] font-normal text-ink-soft">
                {requirements.length === 1 ? 'requirement' : 'requirements'}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
              Updates as you answer. Each one has its own renewal after setup.
            </p>
          </div>

          <ul className="max-h-72 overflow-y-auto overscroll-contain px-5 py-3">
            {requirements.map((r) => (
              <li key={r.key} className="border-b border-edge py-2 last:border-0">
                <div className="text-[13px] font-medium text-ink">{r.name}</div>
                {r.recurring && (
                  <div className="mt-0.5 text-[11px] text-ink-faint">Then: {r.recurring}</div>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-edge px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[13px] text-ink-soft">{pkg.name}</div>
              <div className="numeric text-lg font-semibold text-ink">${pkg.price}</div>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <div className="text-[13px] text-ink-soft">
                {tier.charAt(0)}
                {tier.slice(1).toLowerCase()} membership
              </div>
              <div className="numeric text-[13px] text-ink">
                ${annual}
                <span className="text-ink-faint">/yr</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              ${TIER_ANNUAL_PRICE[tier]} per truck per year for {profile.fleetSize}{' '}
              {profile.fleetSize === 1 ? 'truck' : 'trucks'}. Excludes government filing fees.
            </p>

            {!showCapture && (
              <button
                type="button"
                onClick={() => setShowCapture(true)}
                className="mt-4 w-full rounded-md bg-brand px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Get my setup plan
              </button>
            )}
          </div>
        </div>

        {showCapture && (
          <form onSubmit={submit} className="mt-4 rounded-xl border border-edge bg-surface px-5 py-4">
            <div className="text-[15px] font-semibold text-ink">Where should we send it?</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
              We&apos;ll save your answers so you don&apos;t have to repeat them.
            </p>

            <div className="mt-3 space-y-2.5">
              <Field
                label="Company name"
                value={contact.legalName}
                onChange={(v) => setContact((c) => ({ ...c, legalName: v }))}
                required
              />
              <Field
                label="Your name"
                value={contact.contactName}
                onChange={(v) => setContact((c) => ({ ...c, contactName: v }))}
                required
              />
              <Field
                label="Email"
                type="email"
                value={contact.contactEmail}
                onChange={(v) => setContact((c) => ({ ...c, contactEmail: v }))}
                required
              />
              <Field
                label="Phone"
                type="tel"
                value={contact.contactPhone}
                onChange={(v) => setContact((c) => ({ ...c, contactPhone: v }))}
              />
              <Field
                label="USDOT number"
                hint="Leave blank if you don't have one yet"
                value={contact.dotNumber}
                onChange={(v) => setContact((c) => ({ ...c, dotNumber: v }))}
              />

              <label className="block">
                <span className="text-[12px] font-medium text-ink-soft">Base state</span>
                <select
                  value={contact.state}
                  onChange={(e) => setContact((c) => ({ ...c, state: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-edge-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
                >
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <p className="mt-3 text-[13px] text-critical">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="mt-4 w-full rounded-md bg-brand px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? 'Setting up…' : 'Create my account'}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              No payment now. A compliance specialist reviews your plan and calls you.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-md border px-4 py-1.5 text-[13px] font-medium transition-colors ${
        selected
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-edge-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-critical">*</span>}
        {hint && <span className="ml-1.5 font-normal text-ink-faint">— {hint}</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-edge-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
      />
    </label>
  )
}
