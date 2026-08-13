import { OBLIGATION_LABELS } from '@/rules'
import type { ObligationType } from '@/rules'

/**
 * iCalendar feed generation.
 *
 * The point of this surface is that it requires nothing of the client. No app, no
 * login, no portal to remember — the deadlines appear in the calendar they already
 * look at, and keep updating because the feed is subscribed rather than downloaded.
 */

export interface CalendarEvent {
  uid: string
  date: Date
  title: string
  description: string
}

/** RFC 5545 escaping: commas, semicolons, backslashes, and newlines are special. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** All-day events use a date-only value with no timezone. */
function toIcsDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function toIcsTimestamp(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/**
 * Lines longer than 75 octets must be folded, continuation lines starting with a
 * space. Google Calendar tolerates long lines; Outlook does not.
 */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

export function buildCalendar(name: string, events: CalendarEvent[], now = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sky Transport Solutions//Compliance Radar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'X-WR-TIMEZONE:UTC',
    // Ask subscribing clients to re-poll daily rather than weekly.
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ]

  for (const event of events) {
    const end = new Date(event.date)
    end.setUTCDate(end.getUTCDate() + 1) // DTEND is exclusive for all-day events.

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${toIcsTimestamp(now)}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.date)}`,
      `DTEND;VALUE=DATE:${toIcsDate(end)}`,
      fold(`SUMMARY:${escapeText(event.title)}`),
      fold(`DESCRIPTION:${escapeText(event.description)}`),
      'TRANSP:TRANSPARENT',
      // A reminder a week out, on the morning of the day itself.
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${escapeText(event.title)}`),
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function obligationEvent(o: {
  id: string
  type: ObligationType
  periodLabel: string
  dueOn: Date
  citation: string
  coveredByTier: boolean
  truck?: { unitNumber: string } | null
  driver?: { firstName: string; lastName: string } | null
}): CalendarEvent {
  const subject = o.truck
    ? `Unit ${o.truck.unitNumber}`
    : o.driver
      ? `${o.driver.firstName} ${o.driver.lastName}`
      : null

  const title = subject
    ? `${OBLIGATION_LABELS[o.type]} — ${subject}`
    : OBLIGATION_LABELS[o.type]

  const description = [
    `Period: ${o.periodLabel}`,
    o.coveredByTier
      ? 'Handled by Sky Transport Solutions under your current plan.'
      : 'Not included in your current plan — contact us to add it.',
    `Authority: ${o.citation}`,
  ].join('\n')

  return {
    uid: `${o.id}@compliance-radar.skytransportsolutions.com`,
    date: o.dueOn,
    title,
    description,
  }
}
