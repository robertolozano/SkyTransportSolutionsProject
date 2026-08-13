'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface Option {
  value: string
  label: string
}

/**
 * URL-backed multiselect.
 *
 * Selections live in the query string as a comma-separated list, so a filtered view
 * is a link — shareable, bookmarkable, and survives a refresh. The current params are
 * passed down from the server component rather than read with `useSearchParams`,
 * which keeps this component out of the Suspense requirements that hook carries.
 */
export function MultiSelect({
  label,
  paramName,
  options,
  selected,
  currentParams,
  width = 'w-52',
}: {
  label: string
  paramName: string
  options: Option[]
  selected: string[]
  currentParams: Record<string, string | undefined>
  width?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape — a filter panel should never trap the user.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function apply(values: string[]) {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(currentParams)) {
      if (value && key !== paramName) next.set(key, value)
    }
    if (values.length > 0) next.set(paramName, values.join(','))

    const query = next.toString()
    router.push(query ? `?${query}` : '?', { scroll: false })
  }

  function toggle(value: string) {
    apply(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    )
  }

  const count = selected.length
  const summary =
    count === 0
      ? 'All'
      : count === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? '1 selected')
        : `${count} selected`

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex ${width} items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-[13px] transition-colors ${
          count > 0
            ? 'border-brand bg-brand-soft text-brand'
            : 'border-edge-strong bg-surface text-ink-soft hover:border-ink-faint'
        }`}
      >
        <span className="min-w-0 truncate">
          <span className="text-ink-faint">{label}:</span>{' '}
          <span className={count > 0 ? 'font-medium' : ''}>{summary}</span>
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute left-0 z-20 mt-1 max-h-80 w-max min-w-full overflow-y-auto rounded-md border border-edge bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const checked = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:bg-canvas"
              >
                <span
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                    checked ? 'border-brand bg-brand' : 'border-edge-strong bg-surface'
                  }`}
                >
                  {checked && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden>
                      <path
                        d="M1 3.5L3.2 5.7 8 1"
                        stroke="#fff"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            )
          })}

          {count > 0 && (
            <div className="mt-1 border-t border-edge pt-1">
              <button
                type="button"
                onClick={() => apply([])}
                className="w-full px-3 py-1.5 text-left text-[12px] text-brand hover:bg-canvas"
              >
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Boolean filter rendered as a chip.
 *
 * Kept distinct from the multiselects on purpose — these are single on/off predicates,
 * not a choice among values, and collapsing them into a dropdown would hide state that
 * materially changes what the table shows.
 */
export function FilterToggle({
  label,
  paramName,
  active,
  currentParams,
}: {
  label: string
  paramName: string
  active: boolean
  currentParams: Record<string, string | undefined>
}) {
  const router = useRouter()

  function toggle() {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(currentParams)) {
      if (value && key !== paramName) next.set(key, value)
    }
    if (!active) next.set(paramName, '1')

    const query = next.toString()
    router.push(query ? `?${query}` : '?', { scroll: false })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      className={`rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? 'border-brand bg-brand-soft font-medium text-brand'
          : 'border-edge-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}
