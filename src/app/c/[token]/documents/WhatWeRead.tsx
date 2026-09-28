import type { ReadBack } from '@/server/readBack'

/** The parsed fields read back to the client, so they can catch a misread immediately. */
export function WhatWeRead({ rows, note }: ReadBack) {
  return (
    <div className="rounded-lg border border-edge bg-canvas px-4 py-3">
      <div className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
        What we read
      </div>
      <dl className="mt-2 space-y-1 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-ink-faint">{row.label}</dt>
            <dd className="numeric text-right text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-faint">{note}</p>
    </div>
  )
}
