'use client'

import { useState } from 'react'

/**
 * Calendar subscription.
 *
 * A subscribed feed beats a downloaded file: the deadlines keep updating as the
 * engine recomputes, without the client doing anything. `webcal://` is what makes a
 * phone hand the URL to its calendar app rather than its browser.
 */
export function CalendarSubscribe({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  const path = `/c/${token}/calendar.ics`
  const httpUrl = typeof window === 'undefined' ? path : `${window.location.origin}${path}`
  const webcalUrl = httpUrl.replace(/^https?:/, 'webcal:')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-xl border border-edge bg-surface px-6 py-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
        Put these in your calendar
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Subscribe once and every deadline shows up in the calendar you already use. It stays
        current on its own — nothing to download again later.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={webcalUrl}
          className="rounded-md bg-brand px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Add to calendar
        </a>
        <button
          onClick={copy}
          className="rounded-md border border-edge-strong px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        <a
          href={path}
          className="rounded-md border border-edge-strong px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          Download file
        </a>
      </div>

      <p className="mt-3 text-[13px] text-ink-faint">
        Works with Google Calendar, Apple Calendar, and Outlook.
      </p>
    </section>
  )
}
