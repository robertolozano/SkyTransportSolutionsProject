import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { formatDay, daysBetween } from '@/rules/dates'
import type { ExtractedFields } from '@/server/extract'
import { ensureDemoRequest, isDemoCarrier } from '@/server/demo'
import { readBack } from '@/server/readBack'
import { DocumentUpload } from './DocumentUpload'
import { WhatWeRead } from './WhatWeRead'

export const dynamic = 'force-dynamic'

/**
 * Documents.
 *
 * Outstanding requests first, because that is the only part the carrier can act
 * on. Everything already sent sits beside them on a wide screen and below them
 * on a phone, so the to-do side shrinks as the work gets done rather than growing.
 */
export default async function ClientDocumentsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  await ensureDemoRequest(token)

  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    include: {
      documents: {
        orderBy: [{ status: 'asc' }, { expiresOn: 'asc' }],
        include: { credential: { include: { truck: true, driver: true } } },
      },
    },
  })
  if (!carrier) notFound()

  const asOf = new Date()
  const outstanding = carrier.documents.filter((d) => d.status === 'REQUESTED')
  const received = carrier.documents.filter((d) => d.status === 'RECEIVED')

  const subjectOf = (doc: (typeof carrier.documents)[number]) =>
    doc.credential?.driver
      ? `${doc.credential.driver.firstName} ${doc.credential.driver.lastName}`
      : doc.credential?.truck
        ? `Unit ${doc.credential.truck.unitNumber}`
        : 'Your company'

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      {outstanding.length === 0 ? (
        <section className="rounded-xl border border-good-edge bg-good-soft px-6 py-6">
          <div className="text-xl font-semibold text-ink">Nothing outstanding.</div>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            We have everything we need from you right now. If a document is coming up for renewal,
            we&apos;ll ask for it here about two months ahead.
          </p>
        </section>
      ) : (
        <section>
          <h2 className="mb-1 text-[15px] font-semibold text-ink">
            We need {outstanding.length === 1 ? 'this' : `these ${outstanding.length}`}
          </h2>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-faint">
            Photograph it or attach a PDF — no app or login needed. Lay the document flat, get all
            four corners in frame, and we&apos;ll read the rest.
          </p>

          <ul className="space-y-3">
            {outstanding.map((doc) => {
              const daysLeft = doc.expiresOn ? daysBetween(asOf, doc.expiresOn) : null
              return (
                <li key={doc.id} className="rounded-xl border border-edge bg-surface px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-ink">{doc.type}</div>
                      <div className="mt-0.5 text-[13px] text-ink-faint">{subjectOf(doc)}</div>
                    </div>
                    {doc.expiresOn && (
                      <div className="numeric shrink-0 text-right text-[13px]">
                        <div className="text-ink-soft">Expires {formatDay(doc.expiresOn)}</div>
                        <div
                          className={
                            daysLeft !== null && daysLeft < 0
                              ? 'text-critical'
                              : daysLeft !== null && daysLeft <= 30
                                ? 'text-high'
                                : 'text-ink-faint'
                          }
                        >
                          {daysLeft !== null && daysLeft < 0
                            ? `${Math.abs(daysLeft)} days ago`
                            : `in ${daysLeft} days`}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <DocumentUpload
                      token={token}
                      documentId={doc.id}
                      label={doc.type}
                      demo={isDemoCarrier(carrier)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {received.length === 0 ? (
        <section className="rounded-xl border border-dashed border-edge-strong px-6 py-6 text-[13px] leading-relaxed text-ink-faint">
          Documents you send show up here, along with what we read from them.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
            Already sent
          </h2>
          <ul className="space-y-2">
            {received.map((doc) => {
              const fields = doc.extractedFields as unknown as ExtractedFields | null
              return (
                <li key={doc.id} className="rounded-xl border border-edge bg-surface px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] text-ink">{doc.type}</div>
                      <div className="mt-0.5 text-[13px] text-ink-faint">{subjectOf(doc)}</div>
                    </div>
                    <div className="numeric shrink-0 text-right text-[13px] text-ink-faint">
                      {doc.uploadedAt ? `Sent ${formatDay(doc.uploadedAt)}` : 'Sent'}
                    </div>
                  </div>

                  {doc.extractionStatus === 'EXTRACTED' && fields && (
                    <div className="mt-3">
                      <WhatWeRead {...readBack(fields)} />
                    </div>
                  )}

                  {doc.extractionStatus === 'UNAVAILABLE' && (
                    <p className="mt-2 text-[13px] text-ink-faint">
                      Received. Someone on our team will read it and update your records.
                    </p>
                  )}
                  {doc.extractionStatus === 'FAILED' && (
                    <p className="mt-2 text-[13px] text-ink-faint">
                      Received. We couldn&apos;t read it automatically, so a person is handling it.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

