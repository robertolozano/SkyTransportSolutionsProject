import Link from 'next/link'
import {
  getDeadlines,
  getDeadlineCount,
  getStatesInBook,
  type DeadlineFilters,
  type ObligationStatusFilter,
} from '@/server/queries'
import { OBLIGATION_LABELS, RULES } from '@/rules'
import { daysBetween } from '@/rules/dates'
import { MultiSelect, FilterToggle } from '@/components/MultiSelect'
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

const STATUS_OPTIONS = [
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'DUE', label: 'Due soon' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'COMPLETED', label: 'Filed' },
]

/** Comma-separated query values, e.g. `?status=DUE,OVERDUE`. */
function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams

  const statuses = parseList(sp.status) as ObligationStatusFilter[]
  const types = parseList(sp.type) as ObligationType[]
  const states = parseList(sp.state)

  const filters: DeadlineFilters = {
    statuses,
    types,
    states,
    uncoveredOnly: sp.uncovered === '1',
    blockedOnly: sp.blocked === '1',
  }

  const [rows, total, statesInBook] = await Promise.all([
    getDeadlines(filters),
    getDeadlineCount(filters),
    getStatesInBook(),
  ])
  const asOf = new Date()
  const truncated = rows.length < total

  const activeCount =
    statuses.length +
    types.length +
    states.length +
    (filters.uncoveredOnly ? 1 : 0) +
    (filters.blockedOnly ? 1 : 0)

  return (
    <>
      <PageHeader
        title="Deadlines"
        subtitle={`${
          truncated
            ? `Showing the first ${rows.length} of ${total} matching obligations`
            : `${total} obligation${total === 1 ? '' : 's'} match`
        }${
          statuses.length === 0 ? ', excluding filings already completed' : ''
        }. Every row was derived by a rule — the authority column names which.`}
      />

      <div className="px-8 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <MultiSelect
            label="Status"
            paramName="status"
            options={STATUS_OPTIONS}
            selected={statuses}
            currentParams={sp}
            width="w-48"
          />
          <MultiSelect
            label="Type"
            paramName="type"
            options={RULES.map((r) => ({
              value: r.obligationType,
              label: OBLIGATION_LABELS[r.obligationType],
            }))}
            selected={types}
            currentParams={sp}
            width="w-56"
          />
          <MultiSelect
            label="State"
            paramName="state"
            options={statesInBook.map((s) => ({ value: s, label: s }))}
            selected={states}
            currentParams={sp}
            width="w-40"
          />

          <span className="mx-1 h-5 w-px bg-edge" aria-hidden />

          <FilterToggle
            label="Outside plan"
            paramName="uncovered"
            active={filters.uncoveredOnly ?? false}
            currentParams={sp}
          />
          <FilterToggle
            label="Blocked only"
            paramName="blocked"
            active={filters.blockedOnly ?? false}
            currentParams={sp}
          />

          {activeCount > 0 && (
            <Link
              href="/deadlines"
              className="ml-1 text-[13px] text-brand hover:underline"
              scroll={false}
            >
              Reset
            </Link>
          )}
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

        {truncated && (
          <p className="mt-3 text-[13px] text-ink-faint">
            {total - rows.length} further obligations match these filters and are not shown.
            Narrow the filters to see them.
          </p>
        )}
      </div>
    </>
  )
}
