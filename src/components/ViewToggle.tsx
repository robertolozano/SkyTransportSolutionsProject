'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Staff ↔ client view switch.
 *
 * A demo affordance, and labelled as one. In a real deployment these are two
 * different audiences with two different authentications — a staff member would
 * reach a client's view through the carrier record, and a carrier would never
 * see the console at all. Being explicit about that is better than shipping a
 * control that implies the boundary is softer than it is.
 */
export function ViewToggle({ clientToken }: { clientToken: string | null }) {
  const pathname = usePathname()
  const onClientSide = pathname.startsWith('/c/')

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-edge bg-canvas p-0.5">
      <Segment href="/dashboard" active={!onClientSide} label="Staff" />
      {clientToken ? (
        <Segment href={`/c/${clientToken}`} active={onClientSide} label="Client" />
      ) : (
        <span className="cursor-not-allowed rounded-md px-2.5 py-1 text-[12px] text-ink-faint">
          Client
        </span>
      )}
    </div>
  )
}

function Segment({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
        active ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink-soft'
      }`}
    >
      {label}
    </Link>
  )
}
