import { notFound } from 'next/navigation'
import { getCarrierByToken } from '@/server/queries'
import { assessSubject } from '@/server/assess'
import { OBLIGATION_LABELS } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { CalendarSubscribe } from './CalendarSubscribe'

export const dynamic = 'force-dynamic'

/**
 * Client assurance view.
 *
 * Deliberately not a dashboard. The reader is an owner-operator who opened a link
 * from a text message, and the only questions they have are "am I covered", "what
 * happens next", and "do you need anything from me". Everything else — risk scores,
 * revenue exposure, rule citations — belongs on the staff side.
 *
 * It exists because the work Sky Transport Solutions does is invisible when it goes
 * well, and invisible work is what clients cancel.
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <div className="text-[12px] font-medium uppercase tracking-wider text-ink-faint">
          Sky Transport Solutions
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
          {carrier.legalName}
        </h1>
        <div className="numeric mt-1 text-[13px] text-ink-faint">DOT {carrier.dotNumber}</div>
      </header>

      {/* The answer to the only question that matters. */}
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
              : 'We need one thing from you.'}
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
              {pendingDocs.length === 1 ? 'document' : 'documents'} from you before we can file.
            </>
          )}
        </p>
      </section>

      {pendingDocs.length > 0 && (
        <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            What we need from you
          </h2>
          <ul className="mt-3 space-y-3">
            {pendingDocs.map((doc) => (
              <li key={doc.id} className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[15px] text-ink">{doc.type}</div>
                  {doc.expiresOn && (
                    <div className="mt-0.5 text-[13px] text-ink-faint">
                      Current one expires {formatDay(doc.expiresOn)}
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-white">
                  Send photo
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
            Take a photo with your phone — no app or login needed. Send it and we&apos;ll handle the
            rest.
          </p>
        </section>
      )}

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
        </section>
      )}

      <section className="mb-6 rounded-xl border border-edge bg-surface px-6 py-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
          Coming up
        </h2>
        <ul className="mt-3 divide-y divide-edge">
          {open.slice(0, 8).map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[15px] text-ink">{OBLIGATION_LABELS[o.type]}</div>
                <div className="text-[13px] text-ink-faint">
                  {o.truck
                    ? `Unit ${o.truck.unitNumber}`
                    : o.driver
                      ? `${o.driver.firstName} ${o.driver.lastName}`
                      : 'Company'}
                </div>
              </div>
              <div className="numeric shrink-0 text-right text-[13px]">
                <div className="text-ink-soft">{formatDay(o.dueOn)}</div>
                <div
                  className={
                    o.status === 'OVERDUE'
                      ? 'text-critical'
                      : o.coveredByTier
                        ? 'text-good'
                        : 'text-medium'
                  }
                >
                  {o.status === 'OVERDUE'
                    ? 'Past due'
                    : o.coveredByTier
                      ? 'We handle this'
                      : 'Not in your plan'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

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

      <footer className="mt-10 border-t border-edge pt-5 text-[13px] text-ink-faint">
        Questions? Call (800) 498-9820, Monday–Friday 9:00–5:30 Pacific.
      </footer>
    </main>
  )
}
