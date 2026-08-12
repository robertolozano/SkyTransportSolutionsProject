import Link from 'next/link'
import { getDeadlines, getStatesInBook, type DeadlineFilters } from '@/server/queries'
import { OBLIGATION_LABELS, RULES } from '@/rules'
import { daysBetween } from '@/rules/dates'
import {
  Countdown,
  DateText,
  EmptyState,
  PageHeader,
  StatusPill,
  Table,
  Td,
  Th,
  type Status,
} from '@/components/ui'
import type { ObligationType } from '@/rules'

export const dynamic = 'force-dynamic'

const STATUSES = ['OVERDUE', 'DUE', 'UPCOMING', 'COMPLETED'] as const

function FilterLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
        active
          ? 'border-brand bg-brand-soft font-medium text-brand'
          : 'border-edge bg-surface text-ink-soft hover:border-edge-strong hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams

  const filters: DeadlineFilters = {
    type: sp.type as ObligationType | undefined,
    status: sp.status as DeadlineFilters['status'],
    state: sp.state,
    uncoveredOnly: sp.uncovered === '1',
    blockedOnly: sp.blocked === '1',
  }

  const [rows, states] = await Promise.all([getDeadlines(filters), getStatesInBook()])
  const asOf = new Date()

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { ...sp, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v)
    const s = next.toString()
    return s ? `/deadlines?${s}` : '/deadlines'
  }

  return (
    <>
      <PageHeader
        title="Deadlines"
        subtitle={`${rows.length} obligations shown. Every row was derived by a rule — expand the authority column to see which.`}
      />

      <div className="px-8 py-6">
        <div className="mb-5 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Status
            </span>
            <FilterLink href={qs({ status: undefined })} active={!sp.status}>
              Open
            </FilterLink>
            {STATUSES.map((s) => (
              <FilterLink key={s} href={qs({ status: s })} active={sp.status === s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </FilterLink>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Type
            </span>
            <FilterLink href={qs({ type: undefined })} active={!sp.type}>
              All
            </FilterLink>
            {RULES.map((r) => (
              <FilterLink
                key={r.obligationType}
                href={qs({ type: r.obligationType })}
                active={sp.type === r.obligationType}
              >
                {OBLIGATION_LABELS[r.obligationType]}
              </FilterLink>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Filter
            </span>
            <FilterLink href={qs({ state: undefined })} active={!sp.state}>
              All states
            </FilterLink>
            {states.map((s) => (
              <FilterLink key={s} href={qs({ state: s })} active={sp.state === s}>
                {s}
              </FilterLink>
            ))}
            <span className="mx-1 text-ink-faint">·</span>
            <FilterLink
              href={qs({ uncovered: sp.uncovered === '1' ? undefined : '1' })}
              active={sp.uncovered === '1'}
            >
              Outside plan
            </FilterLink>
            <FilterLink
              href={qs({ blocked: sp.blocked === '1' ? undefined : '1' })}
              active={sp.blocked === '1'}
            >
              Blocked only
            </FilterLink>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState message="No obligations match these filters." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Carrier</Th>
                <Th>Subject</Th>
                <Th>Obligation</Th>
                <Th>Period</Th>
                <Th>Due</Th>
                <Th className="text-right">Left</Th>
                <Th>Status</Th>
                <Th>Blocked by</Th>
                <Th>Authority</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const unmet = o.blockedBy.filter((b) => !b.blocker.completedAt)
                return (
                  <tr key={o.id} className="hover:bg-canvas">
                    <Td>
                      <Link
                        href={`/clients/${o.carrier.dotNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {o.carrier.legalName}
                      </Link>
                      <div className="numeric mt-0.5 text-[11px] text-ink-faint">
                        {o.carrier.city}, {o.carrier.state}
                      </div>
                    </Td>
                    <Td className="text-ink-soft">
                      {o.truck ? (
                        <Link
                          href={`/trucks/${o.truck.vin}`}
                          className="hover:text-brand hover:underline"
                        >
                          Unit {o.truck.unitNumber}
                        </Link>
                      ) : o.driver ? (
                        `${o.driver.firstName} ${o.driver.lastName}`
                      ) : (
                        <span className="text-ink-faint">Carrier</span>
                      )}
                    </Td>
                    <Td className="text-ink">{OBLIGATION_LABELS[o.type]}</Td>
                    <Td className="text-ink-faint">{o.periodLabel}</Td>
                    <Td>
                      <DateText date={o.dueOn} />
                    </Td>
                    <Td className="text-right">
                      <Countdown
                        days={o.status === 'COMPLETED' ? null : daysBetween(asOf, o.dueOn)}
                      />
                    </Td>
                    <Td>
                      <StatusPill status={o.status as Status} />
                    </Td>
                    <Td className="text-[11px] text-ink-soft">
                      {unmet.length === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        unmet.map((b) => OBLIGATION_LABELS[b.blocker.type]).join(', ')
                      )}
                    </Td>
                    <Td className="max-w-[220px] text-[11px] leading-snug text-ink-faint">
                      {o.citation}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </div>
    </>
  )
}
