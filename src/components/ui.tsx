import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatDay } from '@/rules/dates'
import type { RiskLevel } from '@/rules/graph'

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="border-b border-edge bg-surface px-8 py-5">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-[13px] text-ink-soft">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  )
}

export function Section({
  title,
  description,
  right,
  children,
}: {
  title: string
  description?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            {title}
          </h2>
          {description && <p className="mt-1 text-[13px] text-ink-faint">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-edge bg-surface ${className}`}>{children}</div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-edge-strong bg-surface px-6 py-10 text-center text-[13px] text-ink-faint">
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status language — used identically on every screen
// ---------------------------------------------------------------------------

export type Status = 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED'

const STATUS_STYLES: Record<Status, string> = {
  OVERDUE: 'bg-critical-soft text-critical border-critical-edge',
  DUE: 'bg-high-soft text-high border-high-edge',
  UPCOMING: 'bg-canvas text-ink-soft border-edge-strong',
  COMPLETED: 'bg-good-soft text-good border-good-edge',
}

const STATUS_LABELS: Record<Status, string> = {
  OVERDUE: 'Overdue',
  DUE: 'Due soon',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Filed',
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

const RISK_STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'bg-critical-soft text-critical border-critical-edge',
  HIGH: 'bg-high-soft text-high border-high-edge',
  MEDIUM: 'bg-medium-soft text-medium border-medium-edge',
  LOW: 'bg-good-soft text-good border-good-edge',
}

export function RiskPill({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${RISK_STYLES[level]}`}
    >
      {level.charAt(0) + level.slice(1).toLowerCase()}
    </span>
  )
}

/** Days remaining, coloured by urgency. Negative reads as "N days late". */
export function Countdown({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[13px] text-ink-faint">—</span>

  const tone =
    days < 0 ? 'text-critical' : days <= 30 ? 'text-high' : days <= 90 ? 'text-medium' : 'text-ink-soft'

  return (
    <span className={`numeric text-[13px] font-medium ${tone}`}>
      {days < 0 ? `${Math.abs(days)}d late` : `${days}d`}
    </span>
  )
}

export function DateText({ date }: { date: Date | null | undefined }) {
  if (!date) return <span className="text-ink-faint">—</span>
  return <span className="numeric text-[13px] text-ink-soft">{formatDay(date)}</span>
}

const TIER_STYLES: Record<string, string> = {
  SILVER: 'bg-canvas text-ink-soft border-edge-strong',
  GOLD: 'bg-medium-soft text-medium border-medium-edge',
  DIAMOND: 'bg-brand-soft text-brand border-indigo-200',
}

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${TIER_STYLES[tier] ?? TIER_STYLES.SILVER}`}
    >
      {tier.charAt(0) + tier.slice(1).toLowerCase()}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'critical' | 'high' | 'good'
  href?: string
}) {
  const toneClass = {
    neutral: 'text-ink',
    critical: 'text-critical',
    high: 'text-high',
    good: 'text-good',
  }[tone]

  const body = (
    <div className="rounded-lg border border-edge bg-surface px-4 py-3.5 transition-colors hover:border-edge-strong">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`numeric mt-1.5 text-2xl font-semibold tracking-tight ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-ink-faint">{hint}</div>}
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

export function money(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-edge bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left">{children}</table>
    </div>
  )
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-edge px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-edge px-4 py-2.5 text-[13px] ${className}`}>{children}</td>
}

export type SortDirection = 'asc' | 'desc'

/**
 * Sortable column header.
 *
 * Deliberately a plain link rather than a click handler: sort state belongs in the
 * URL alongside the filters, so a sorted view is shareable and survives a refresh,
 * and the whole control needs no client-side JavaScript.
 */
export function SortableTh({
  label,
  column,
  activeSort,
  activeDir,
  params,
  basePath,
  className = '',
  defaultDir = 'asc',
}: {
  label: string
  column: string
  activeSort: string
  activeDir: SortDirection
  params: Record<string, string | undefined>
  basePath: string
  className?: string
  /** Direction applied on first click. Dates read best ascending, counts descending. */
  defaultDir?: SortDirection
}) {
  const isActive = activeSort === column
  const nextDir: SortDirection = isActive ? (activeDir === 'asc' ? 'desc' : 'asc') : defaultDir

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'sort' && key !== 'dir') query.set(key, value)
  }
  query.set('sort', column)
  query.set('dir', nextDir)

  const alignRight = className.includes('text-right')

  return (
    <th
      className={`border-b border-edge px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${
        isActive ? 'text-ink' : 'text-ink-faint'
      } ${className}`}
      aria-sort={isActive ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        href={`${basePath}?${query.toString()}`}
        scroll={false}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-ink ${
          alignRight ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        <SortArrow active={isActive} direction={activeDir} />
      </Link>
    </th>
  )
}

function SortArrow({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <svg
      width="8"
      height="10"
      viewBox="0 0 8 10"
      fill="none"
      aria-hidden
      className={active ? 'text-ink' : 'text-transparent group-hover:text-ink-faint'}
    >
      <path
        d={direction === 'asc' && active ? 'M4 1L7 5H1L4 1Z' : 'M4 9L1 5H7L4 9Z'}
        fill="currentColor"
      />
    </svg>
  )
}
