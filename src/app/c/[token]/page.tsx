import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCarrierByToken } from '@/server/queries'
import { assessSubject } from '@/server/assess'
import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { CalendarSubscribe } from './CalendarSubscribe'

export const dynamic = 'force-dynamic'

/**
 * Overview.
 *
 * Answers the only three questions a carrier actually has, in order: am I
 * covered, do you need anything from me, and what happens next. Risk scores,
 * revenue exposure, and rule citations all stay on the staff side.
 */
export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const carrier = await getCarrierByToken(token)
  if (!carrier) notFound()

  const asOf = new Date()
  const open = carrier.obligations.filter((o) => o.status !== 'COMPLETED')
  const overdue = open.filter((o) => o.status === 'OVERDUE')
  const handled = open.filter((o) => o.coveredByTier)
  const notCovered = open.filter((o) => !o.coveredByTier)
  const next = handled[0] ?? open[0] ?? null

  const pendingDocs = carrier.documents.filter((d) => d.status === 'REQUESTED')
  const filedCount = carrier.obligations.filter((o) => o.status === 'COMPLETED').length
  const assessment = assessSubject(carrier.obligations, asOf)

  const allClear = overdue.length === 0 && pendingDocs.length === 0

  /*
    A prospect has no fleet and therefore no obligations, which would otherwise
    render as "You're covered — 0 requirements across 0 trucks". That is the
    right data and completely the wrong message: nothing is being tracked yet
    because setup hasn't happened. Onboarding gets its own state.
  */
  if (carrier.status === 'PROSPECT') {
    return (
      <>
        <section className="mb-6 rounded-xl border border-medium-edge bg-medium-soft px-6 py-6">
          <div className="text-xl font-semibold text-ink">We&apos;re setting you up.</div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            A compliance specialist is reviewing the answers you gave and will call you within one
            business day. Once your registrations are filed, this page starts tracking every
            renewal for you — and we&apos;ll ask here for anything we need.
          </p>
        </section>

        <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Your plan
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <div className="text-[15px] font-medium text-ink">
              {carrier.recommendedPackage ?? 'Setup package'}
            </div>
            {carrier.recommendedPrice != null && (
              <div className="numeric text-lg font-semibold text-ink">
                ${carrier.recommendedPrice}
              </div>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            Nothing has been charged. We confirm everything with you before filing.
          </p>
        </section>

        {pendingDocs.length > 0 && (
          <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
            <h2 className="text-[15px] font-semibold text-ink">We need something from you</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {pendingDocs.length} {pendingDocs.length === 1 ? 'document' : 'documents'} to get
              started.
            </p>
            <Link
              href={`/c/${token}/documents`}
              className="mt-3 inline-block rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Send {pendingDocs.length === 1 ? 'it' : 'them'}
            </Link>
          </section>
        )}

        <p className="text-[13px] leading-relaxed text-ink-faint">
          Questions in the meantime? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
        </p>
      </>
    )
  }

  return (
    <>
      <section
        className={`mb-6 rounded-xl border px-6 py-6 ${
          allClear
            ? 'border-good-edge bg-good-soft'
            : overdue.length > 0
              ? 'border-critical-edge bg-critical-soft'
              : 'border-medium-edge bg-medium-soft'
        }`}
      >
        <div className="text-xl font-semibold text-ink">
          {allClear
            ? "You're covered."
            : overdue.length > 0
              ? 'Something needs attention.'
              : `We need ${pendingDocs.length === 1 ? 'one thing' : 'a few things'} from you.`}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {allClear ? (
            <>
              We&apos;re tracking {open.length} upcoming{' '}
              {open.length === 1 ? 'requirement' : 'requirements'} across{' '}
              {carrier.trucks.length} {carrier.trucks.length === 1 ? 'truck' : 'trucks'}, and
              we&apos;ve filed {filedCount} on your behalf. There&apos;s nothing you need to do
              right now.
            </>
          ) : overdue.length > 0 ? (
            <>
              {overdue.length} {overdue.length === 1 ? 'item is' : 'items are'} past due. We&apos;re
              on it — someone from our office will be in touch. If a truck is affected, call us
              before it moves.
            </>
          ) : (
            <>
              Everything is on schedule, but we&apos;re waiting on {pendingDocs.length}{' '}
              {pendingDocs.length === 1 ? 'document' : 'documents'} before we can file.
            </>
          )}
        </p>

        {pendingDocs.length > 0 && (
          <Link
            href={`/c/${token}/documents`}
            className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Send {pendingDocs.length === 1 ? 'it' : 'them'} now
          </Link>
        )}
      </section>

      {next && (
        <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Next up
          </h2>
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <div>
              <div className="text-[15px] font-medium text-ink">
                {OBLIGATION_LABELS[next.type]}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-faint">
                {next.truck
                  ? `Unit ${next.truck.unitNumber}`
                  : next.driver
                    ? `${next.driver.firstName} ${next.driver.lastName}`
                    : 'Your company'}
                {next.coveredByTier ? ' · we handle this' : ' · not in your current plan'}
              </div>
            </div>
            <div className="numeric shrink-0 text-right">
              <div className="text-[15px] font-medium text-ink">{formatDay(next.dueOn)}</div>
              <div className="text-[13px] text-ink-faint">
                {daysBetween(asOf, next.dueOn)} days
              </div>
            </div>
          </div>
          <Link
            href={`/c/${token}/deadlines`}
            className="mt-4 inline-block text-[13px] text-brand hover:underline"
          >
            See everything coming up →
          </Link>
        </section>
      )}

      {notCovered.length > 0 && (
        <section className="mb-6 rounded-xl border border-medium-edge bg-medium-soft px-6 py-5">
          <h2 className="text-[15px] font-semibold text-ink">
            {notCovered.length} {notCovered.length === 1 ? 'item is' : 'items are'} outside your{' '}
            {carrier.tier.toLowerCase()} plan
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            {Array.from(new Set(notCovered.map((o) => OBLIGATION_LABELS[o.type]))).join(', ')}.
            We&apos;ll still remind you, but we&apos;re not filing these unless you ask. Call us if
            you&apos;d like them added.
          </p>
        </section>
      )}

      <CalendarSubscribe token={token} />

      {assessment.date && (
        <p className="mt-8 text-[13px] leading-relaxed text-ink-faint">
          Your earliest registration deadline is {formatDay(assessment.date)}. We start work well
          before that date — you don&apos;t need to track it.
        </p>
      )}
    </>
  )
}
