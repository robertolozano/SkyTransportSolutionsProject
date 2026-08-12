/**
 * Date helpers.
 *
 * Everything here operates in UTC on purpose. Compliance deadlines are calendar
 * dates, not instants — "August 31" must not become "August 30" because the server
 * happens to run in a timezone behind the client.
 */

/** Construct a UTC calendar date. `month` is 1-based. */
export function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

/** Strip any time component, normalising to UTC midnight. */
export function toUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function lastDayOfMonth(year: number, month: number): Date {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0))
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

/** Whole days from `a` to `b`. Negative when `b` is in the past. */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((toUtcDay(b).getTime() - toUtcDay(a).getTime()) / MS_PER_DAY)
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/**
 * Roll a due date forward off a weekend.
 *
 * Note: federal holidays are NOT handled. Doing that properly needs a holiday
 * calendar per jurisdiction, which is out of scope here — flagged on the /rules page
 * rather than silently approximated.
 */
export function nextBusinessDay(d: Date): Date {
  let out = d
  while (isWeekend(out)) out = addDays(out, 1)
  return out
}

export function withinHorizon(due: Date, asOf: Date, horizonDays: number): boolean {
  const delta = daysBetween(asOf, due)
  return delta >= -365 && delta <= horizonDays
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
