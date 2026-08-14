import Link from 'next/link'
import { StartWizard } from './StartWizard'

export const metadata = {
  title: 'Start a trucking company — Sky Transport Solutions',
  description:
    'Answer a few questions and see exactly which permits, registrations, and filings your operation needs.',
}

/**
 * Public entry point.
 *
 * No token, no login, no client data — because the reader is not a customer yet.
 * This is the top of the funnel: a prospect who found Sky through a search and
 * wants to know what starting a trucking company actually involves.
 */
export default function StartPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-[12px] font-medium uppercase tracking-wider text-ink-faint">
              Sky Transport Solutions
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight text-ink">
              Tracy, California · Serving all 50 states since 2005
            </div>
          </div>
          <a
            href="tel:8004989820"
            className="hidden shrink-0 text-[13px] text-brand hover:underline sm:block"
          >
            (800) 498-9820
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Find out exactly what your trucks need to run legally.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Every truck needs permissions from several different agencies, each with its own
            renewal. Answer six questions and we&apos;ll show you which ones apply to your
            operation, in the order they have to happen — and what it costs to have us handle them.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Takes about a minute. No payment, and nothing is filed until you say so.
          </p>
        </div>

        <div className="mt-8">
          <StartWizard />
        </div>

        <footer className="mt-12 border-t border-edge pt-6 text-[13px] leading-relaxed text-ink-faint">
          Already a client?{' '}
          <span className="text-ink-soft">
            Use the link we sent you, or call (800) 498-9820 and we&apos;ll resend it.
          </span>
          <div className="mt-2">
            <Link href="/dashboard" className="text-brand hover:underline">
              Staff console
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
