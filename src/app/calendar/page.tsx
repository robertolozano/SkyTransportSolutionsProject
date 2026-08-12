import Link from 'next/link'
import { getMonthlyVolume } from '@/server/queries'
import { PageHeader, Section, Card, Table, Td, Th, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

const SERIES = [
  { key: 'ifta', label: 'Fuel tax', color: 'var(--color-brand)' },
  { key: 'hvut', label: 'Heavy vehicle tax', color: 'var(--color-high)' },
  { key: 'ucr', label: 'Annual federal fee', color: 'var(--color-medium)' },
  { key: 'irp', label: 'Plate renewal', color: 'var(--color-critical)' },
  { key: 'ctc', label: 'Emissions', color: 'var(--color-good)' },
  { key: 'other', label: 'Other', color: 'var(--color-ink-faint)' },
] as const

/**
 * The seasonal wave.
 *
 * Deadlines are not evenly distributed — fuel tax lands on four fixed dates for every
 * interstate client at once, the heavy vehicle tax peaks in August, and the annual
 * federal fee closes out December. Twelve months of derived obligations, bucketed by
 * month, shows exactly where twenty-five people are underwater.
 */
export default async function CalendarPage() {
  const months = await getMonthlyVolume()
  if (months.length === 0) {
    return (
      <>
        <PageHeader title="Calendar" />
        <div className="px-8 py-6">
          <EmptyState message="No obligations in the next twelve months." />
        </div>
      </>
    )
  }

  const peak = Math.max(...months.map((m) => m.total))
  const mean = months.reduce((s, m) => s + m.total, 0) / months.length
  const heaviest = months.reduce((a, b) => (a.total > b.total ? a : b))

  const label = (d: Date) =>
    new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: '2-digit' })

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Twelve months of derived deadlines, bucketed by month. The peaks are the reason compliance work cannot be staffed to the average."
      />

      <div className="px-8 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Busiest month</div>
            <div className="mt-1.5 text-2xl font-semibold text-ink">{label(heaviest.month)}</div>
            <div className="numeric mt-1 text-[11px] text-ink-faint">
              {heaviest.total} filings due
            </div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Monthly average</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">{Math.round(mean)}</div>
            <div className="mt-1 text-[11px] text-ink-faint">filings per month</div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Peak vs average</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-high">
              {(peak / mean).toFixed(1)}×
            </div>
            <div className="mt-1 text-[11px] text-ink-faint">the flat-staffing gap</div>
          </Card>
          <Card className="px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Next 12 months</div>
            <div className="numeric mt-1.5 text-2xl font-semibold text-ink">
              {months.reduce((s, m) => s + m.total, 0)}
            </div>
            <div className="mt-1 text-[11px] text-ink-faint">total filings</div>
          </Card>
        </div>

        <Section title="Filing volume by month">
          <Card className="px-5 py-5">
            <div className="flex items-end gap-2" style={{ height: 220 }}>
              {months.map((m) => {
                const stacked = SERIES.map((s) => ({
                  ...s,
                  value: Number(m[s.key as keyof typeof m] ?? 0),
                })).filter((s) => s.value > 0)

                return (
                  <div key={String(m.month)} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="numeric text-[11px] font-medium text-ink-soft">{m.total}</div>
                    <div
                      className="flex w-full max-w-[52px] flex-col-reverse overflow-hidden rounded-t"
                      style={{ height: `${(m.total / peak) * 160}px` }}
                      title={`${label(m.month)}: ${m.total} filings`}
                    >
                      {stacked.map((s) => (
                        <div
                          key={s.key}
                          style={{
                            backgroundColor: s.color,
                            height: `${(s.value / m.total) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-ink-faint">{label(m.month)}</div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-4 border-t border-edge pt-4">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[12px] text-ink-soft">{s.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section
          title="Month detail"
          description="Where the volume comes from, so the peaks can be attributed rather than guessed at."
        >
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">Total</Th>
                {SERIES.map((s) => (
                  <Th key={s.key} className="text-right">
                    {s.label}
                  </Th>
                ))}
                <Th className="text-right">vs average</Th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const ratio = m.total / mean
                return (
                  <tr key={String(m.month)} className="hover:bg-canvas">
                    <Td className="font-medium text-ink">{label(m.month)}</Td>
                    <Td className="numeric text-right font-medium text-ink">{m.total}</Td>
                    {SERIES.map((s) => (
                      <Td key={s.key} className="numeric text-right text-ink-soft">
                        {Number(m[s.key as keyof typeof m]) || <span className="text-ink-faint">—</span>}
                      </Td>
                    ))}
                    <Td
                      className={`numeric text-right font-medium ${
                        ratio >= 1.5 ? 'text-critical' : ratio >= 1.15 ? 'text-high' : 'text-ink-soft'
                      }`}
                    >
                      {ratio.toFixed(1)}×
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Section>

        <p className="text-[13px] leading-relaxed text-ink-faint">
          Each obligation also carries the earliest date it may legally begin, which is what a
          pull-forward scheduler would use to flatten these peaks. That is computed and stored but
          not yet surfaced as a plan — see the{' '}
          <Link href="/rules" className="text-brand hover:underline">
            rules page
          </Link>{' '}
          for what is and is not implemented.
        </p>
      </div>
    </>
  )
}
