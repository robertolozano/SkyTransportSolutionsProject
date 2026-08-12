import Link from 'next/link'
import { OBLIGATION_LABELS } from '@/rules'
import { formatDay } from '@/rules/dates'
import type { ObligationType } from '@/rules'

export interface ChainNode {
  id: string
  type: ObligationType
  dueOn: Date
  status: string
  isTarget?: boolean
  href?: string
}

/**
 * The gate diagram.
 *
 * Reads left to right as prerequisites feeding the deadline they protect. The final
 * node is the one that actually parks the truck; everything before it is a cause.
 */
export function DependencyChain({ nodes }: { nodes: ChainNode[] }) {
  if (nodes.length === 0) return null

  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-stretch gap-1.5">
          <ChainCard node={node} />
          {i < nodes.length - 1 && (
            <div className="flex items-center px-0.5 text-ink-faint" aria-hidden>
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path
                  d="M0 5h13M9 1l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ChainCard({ node }: { node: ChainNode }) {
  const tone =
    node.status === 'OVERDUE'
      ? 'border-critical-edge bg-critical-soft'
      : node.status === 'DUE'
        ? 'border-high-edge bg-high-soft'
        : node.status === 'COMPLETED'
          ? 'border-good-edge bg-good-soft'
          : 'border-edge bg-surface'

  const body = (
    <div
      className={`min-w-[132px] rounded-md border px-2.5 py-2 ${tone} ${
        node.isTarget ? 'ring-1 ring-ink/15' : ''
      }`}
    >
      <div className="text-[11px] font-medium leading-tight text-ink">
        {OBLIGATION_LABELS[node.type]}
      </div>
      <div className="numeric mt-0.5 text-[11px] text-ink-soft">{formatDay(node.dueOn)}</div>
      {node.isTarget && (
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Out of service
        </div>
      )}
    </div>
  )

  return node.href ? (
    <Link href={node.href} className="transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  )
}
