import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCarrierByToken } from '@/server/queries'
import { assessSubject } from '@/server/assess'
import { ensureDemoRequest } from '@/server/demo'
import { OBLIGATION_LABELS } from '@/rules'
import { formatDay } from '@/rules/dates'
import { Stat } from '@/components/ui'
import { CalendarSubscribe } from './CalendarSubscribe'
import { DeadlineRow } from './DeadlineRow'

export const dynamic = 'force-dynamic'

/** How many upcoming deadlines the overview previews before "see everything". */
const PREVIEW_COUNT = 5

/**
 * Overview.
 *
 * Answers the only three questions a carrier actually has, in order: am I
 * covered, do you need anything from me, and what happens next. Risk scores,
 * revenue exposure, and rule citations all stay on the staff side.
 *
 * On a wide screen the answer to "what happens next" takes the main column and
 * the set-and-forget items (calendar feed, registration date) sit beside it; on
 * a phone everything stacks in that same order.
 */
export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  await ensureDemoRequest(token)
  const carrier = await getCarrierByToken(token)
  if (!carrier) notFound()

  const asOf = new Date()
  const open = carrier.obligations.filter((o) => o.status !== 'COMPLETED')
  const overdue = open.filter((o) => o.status === 'OVERDUE')
  const handled = open.filter((o) => o.coveredByTier)
  const notCovered = open.filter((o) => !o.coveredByTier)

  const pendingDocs = carrier.documents.filter((d) => d.status === 'REQUESTED')
  const filedCount = carrier.obligations.filter((o) => o.status === 'COMPLETED').length
  const assessment = assessSubject(carrier.obligations, asOf)

  const allClear = overdue.length === 0 && pendingDocs.length === 0
  const plan = carrier.tier.toLowerCase()

  /*
    A prospect has no fleet and therefore no obligations, which would otherwise
    render as "You're covered — 0 requirements across 0 trucks". That is the
    right data and completely the wrong message: nothing is being tracked yet
    because setup hasn't happened. Onboarding gets its own state.
  */
  if (carrier.status === 'PROSPECT') {
    return (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-medium-edge bg-medium-soft px-6 py-6">
            <div className="text-xl font-semibold text-ink">We&apos;re setting you up.</div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              A compliance specialist is reviewing the answers you gave and will call you within
              one business day. Once your registrations are filed, this page starts tracking every
              renewal for you — and we&apos;ll ask here for anything we need.
            </p>
          </section>

          {pendingDocs.length > 0 && (
            <section className="rounded-xl border border-edge bg-surface px-6 py-5">
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
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-edge bg-surface px-6 py-5">
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

          <p className="text-[13px] leading-relaxed text-ink-faint">
            Questions in the meantime? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
          </p>
        </aside>
      </div>
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
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
                  {overdue.length} {overdue.length === 1 ? 'item is' : 'items are'} past due.
                  We&apos;re on it — someone from our office will be in touch. If a truck is
                  affected, call us before it moves.
                </>
              ) : (
                <>
                  Everything is on schedule, but we&apos;re waiting on {pendingDocs.length}{' '}
                  {pendingDocs.length === 1 ? 'document' : 'documents'} before we can file.
                </>
              )}
            </p>
          </div>

          {pendingDocs.length > 0 && (
            <Link
              href={`/c/${token}/documents`}
              className="shrink-0 rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Send {pendingDocs.length === 1 ? 'it' : 'them'} now
            </Link>
          )}
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Upcoming"
          value={open.length}
          hint={`Across ${carrier.trucks.length} ${carrier.trucks.length === 1 ? 'truck' : 'trucks'}`}
        />
        <Stat label="We handle" value={handled.length} hint={`Under your ${plan} plan`} tone="good" />
        <Stat label="Filed for you" value={filedCount} hint="Already done" />
        <Stat
          label="Needed from you"
          value={pendingDocs.length}
          hint={pendingDocs.length === 0 ? 'Nothing right now' : 'Waiting on a document'}
          tone={pendingDocs.length > 0 ? 'high' : 'neutral'}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {open.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-edge bg-surface">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                  Next up
                </h2>
                <Link href={`/c/${token}/deadlines`} className="text-[13px] text-brand hover:underline">
                  See everything coming up →
                </Link>
              </div>
              <ul className="divide-y divide-edge border-t border-edge">
                {open.slice(0, PREVIEW_COUNT).map((o) => (
                  <DeadlineRow key={o.id} obligation={o} asOf={asOf} />
                ))}
              </ul>
            </section>
          )}

          {notCovered.length > 0 && (
            <section className="rounded-xl border border-medium-edge bg-medium-soft px-6 py-5">
              <h2 className="text-[15px] font-semibold text-ink">
                {notCovered.length} {notCovered.length === 1 ? 'item is' : 'items are'} outside
                your {plan} plan
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                {Array.from(new Set(notCovered.map((o) => OBLIGATION_LABELS[o.type]))).join(', ')}.
                We&apos;ll still remind you, but we&apos;re not filing these unless you ask. Call us
                if you&apos;d like them added.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <CalendarSubscribe token={token} />

          {assessment.date && (
            <section className="rounded-xl border border-edge bg-surface px-6 py-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Registration
              </h2>
              <div className="numeric mt-3 text-[15px] font-medium text-ink">
                {formatDay(assessment.date)}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Your earliest registration deadline. We start work well before that date — you
                don&apos;t need to track it.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
