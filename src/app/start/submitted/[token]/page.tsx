import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirementsForToken } from '../../actions'
import { TIER_ANNUAL_PRICE } from '@/rules/pricing'

export const dynamic = 'force-dynamic'

/**
 * Post-signup confirmation.
 *
 * The prospect now has a real record and a portal link. Two things matter here:
 * showing the plan they just generated (so the answers were visibly worth
 * giving), and being concrete about what happens next — a compliance business
 * lives on people trusting that something is actually being handled.
 */
export default async function SubmittedPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await requirementsForToken(token)
  if (!result) notFound()

  const { carrier, profile, requirements, pkg, tier } = result
  const annual = TIER_ANNUAL_PRICE[tier] * Math.max(1, profile.fleetSize)
  const hasDot = !carrier.dotNumber.startsWith('PENDING-')

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="text-[12px] font-medium uppercase tracking-wider text-ink-faint">
            Sky Transport Solutions
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <section className="rounded-xl border border-good-edge bg-good-soft px-6 py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            You&apos;re set up, {carrier.contactName?.split(' ')[0] ?? 'thanks'}.
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            We&apos;ve created an account for {carrier.legalName} and saved your answers. A
            compliance specialist will call you within one business day to confirm the details and
            start filing.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Your plan
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-edge pb-3">
            <div>
              <div className="text-[15px] font-medium text-ink">{pkg.name}</div>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-soft">
                {pkg.rationale}
              </p>
            </div>
            <div className="numeric text-xl font-semibold text-ink">${pkg.price}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="text-[15px] font-medium text-ink">
                {tier.charAt(0)}
                {tier.slice(1).toLowerCase()} membership
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">
                We track and file the renewals below so you don&apos;t have to.
              </p>
            </div>
            <div className="numeric text-[15px] text-ink">
              ${annual}
              <span className="text-ink-faint">/yr</span>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            What you need, in order
          </h2>
          <ol className="mt-3 space-y-3">
            {requirements.map((r, i) => (
              <li key={r.key} className="flex items-start gap-3">
                <span className="numeric mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-medium text-ink-soft">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-ink">{r.name}</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{r.why}</p>
                  {r.recurring && (
                    <div className="mt-1 text-[12px] text-ink-faint">
                      Recurring: {r.recurring}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Your account
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            This is your private link. We&apos;d normally email it — bookmark it to check status,
            see upcoming deadlines, and send us documents.
          </p>
          <Link
            href={`/c/${token}`}
            className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Open my account
          </Link>
          {!hasDot && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
              You told us you don&apos;t have a USDOT number yet — obtaining one is the first thing
              we&apos;ll do, and it&apos;s included in your package.
            </p>
          )}
        </section>

        <footer className="mt-8 text-[13px] text-ink-faint">
          Questions before we call? (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
        </footer>
      </main>
    </div>
  )
}
