import Link from 'next/link'
import { prisma } from '@/server/db'
import { formatDay } from '@/rules/dates'
import {
  compareToCredential,
  extractionConfigured,
  DOCUMENT_TYPE_LABELS,
  type DetectedDocumentType,
  type ExtractedFields,
} from '@/server/extract'
import { Card, EmptyState, PageHeader, Section, Stat } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Scan review.
 *
 * The counterpart to the client's upload: everything a carrier has sent, with what
 * the model read set against what the credential record already says.
 *
 * The design point is that extraction *proposes* and a person *commits*. Rows
 * where the two disagree are the whole reason this screen exists — a plate that
 * expires a month earlier than the record claims is exactly the drift that puts a
 * truck on the road against a deadline nobody is tracking.
 */
export default async function ScansPage() {
  const documents = await prisma.document.findMany({
    where: { status: 'RECEIVED', uploadedAt: { not: null } },
    include: {
      carrier: true,
      credential: { include: { truck: true, driver: true } },
    },
    orderBy: { uploadedAt: 'desc' },
    take: 60,
  })

  const configured = extractionConfigured()
  const extracted = documents.filter((d) => d.extractionStatus === 'EXTRACTED')
  const lowConfidence = extracted.filter((d) => d.confidence === 'low')
  const awaitingReview = documents.filter((d) => !d.reviewedAt)

  return (
    <>
      <PageHeader
        title="Scans"
        subtitle="Documents clients have sent, with what was read from the image set against what the record says. Extraction proposes; a person confirms."
      />

      <div className="px-8 py-6">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Received" value={documents.length} hint="Uploaded by clients" />
          <Stat label="Read automatically" value={extracted.length} tone="good" />
          <Stat
            label="Low confidence"
            value={lowConfidence.length}
            hint="Routed to a person"
            tone={lowConfidence.length > 0 ? 'high' : 'neutral'}
          />
          <Stat label="Awaiting review" value={awaitingReview.length} hint="Not yet confirmed" />
        </div>

        <div className="mb-6 rounded-lg border border-edge bg-surface px-5 py-4">
          <div className="text-[13px] font-semibold text-ink">Two reading paths, one pipeline</div>
          <div className="mt-2 grid gap-4 text-[13px] leading-relaxed text-ink-soft lg:grid-cols-2">
            <div>
              <div className="font-medium text-ink">PDF → deterministic parser</div>
              <p className="mt-1">
                Reads the PDF text layer and pulls fields by their printed labels. No model, no
                credentials, no variance — and genuinely the right tool for generated documents:
                issued certificates, cab cards, insurance binders. <span className="text-ink">This
                is the path the demo runs.</span>
              </p>
            </div>
            <div>
              <div className="font-medium text-ink">Photograph → vision model</div>
              <p className="mt-1">
                A photo has no text layer, so reading one needs vision. That is the case that
                actually matters in production — a driver photographing a card at a truck stop —
                and it is what a deployed system would run.{' '}
                {configured ? (
                  <span className="text-good">Credentials are configured here.</span>
                ) : (
                  <span className="text-medium">
                    No <span className="numeric">ANTHROPIC_API_KEY</span> is set in this
                    environment, so photographs are stored and queued for a person instead.
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="mt-3 border-t border-edge pt-3 text-[13px] leading-relaxed text-ink-faint">
            Both paths return the same shape, so reconciliation, review, and the client&apos;s
            &ldquo;what we read&rdquo; panel are identical either way. Nothing here is simulated —
            an unread document is shown as unread.
          </p>
        </div>

        <Section title="Recent uploads">
          {documents.length === 0 ? (
            <EmptyState message="No documents have been submitted yet." />
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const fields = doc.extractedFields as unknown as ExtractedFields | null
                const comparisons = fields ? compareToCredential(fields, doc.credential) : []
                const conflicts = comparisons.filter((c) => c.conflict)

                return (
                  <Card key={doc.id} className="overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge px-5 py-3.5">
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${doc.carrier.dotNumber}`}
                          className="text-[15px] font-medium text-ink hover:text-brand hover:underline"
                        >
                          {doc.carrier.legalName}
                        </Link>
                        <div className="mt-0.5 text-[13px] text-ink-faint">
                          {doc.type}
                          {doc.credential?.driver
                            ? ` · ${doc.credential.driver.firstName} ${doc.credential.driver.lastName}`
                            : doc.credential?.truck
                              ? ` · Unit ${doc.credential.truck.unitNumber}`
                              : ''}
                          {doc.uploadedAt ? ` · sent ${formatDay(doc.uploadedAt)}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {doc.confidence && (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                              doc.confidence === 'low'
                                ? 'border-critical-edge bg-critical-soft text-critical'
                                : doc.confidence === 'medium'
                                  ? 'border-medium-edge bg-medium-soft text-medium'
                                  : 'border-good-edge bg-good-soft text-good'
                            }`}
                          >
                            {doc.confidence} confidence
                          </span>
                        )}
                        {conflicts.length > 0 && (
                          <span className="rounded border border-critical-edge bg-critical-soft px-1.5 py-0.5 text-[11px] font-medium text-critical">
                            {conflicts.length} mismatch{conflicts.length === 1 ? '' : 'es'}
                          </span>
                        )}
                        {doc.extractionMethod && (
                          <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] text-ink-soft">
                            {doc.extractionMethod === 'PDF_TEXT'
                              ? 'PDF text parser'
                              : 'Vision model'}
                          </span>
                        )}
                        <span className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] text-ink-soft">
                          {doc.extractionStatus.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-4 lg:grid-cols-[200px_1fr]">
                      <div>
                        {/* A PDF will not render in an <img>, so it gets its own affordance. */}
                        {doc.storagePath && doc.mimeType === 'application/pdf' ? (
                          <a
                            href={`/api/documents/${doc.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-28 flex-col items-center justify-center rounded-md border border-edge bg-canvas text-[12px] text-ink-soft transition-colors hover:border-edge-strong"
                          >
                            <span className="text-[22px]">📄</span>
                            <span className="mt-1 font-medium">Open PDF</span>
                            <span className="mt-0.5 text-ink-faint">
                              {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : ''}
                            </span>
                          </a>
                        ) : doc.storagePath ? (
                          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/documents/${doc.id}`}
                              alt={`${doc.type} submitted by ${doc.carrier.legalName}`}
                              className="max-h-40 w-full rounded-md border border-edge object-cover"
                            />
                          </a>
                        ) : (
                          <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-edge-strong text-[12px] text-ink-faint">
                            No file
                          </div>
                        )}
                      </div>

                      <div>
                        {fields ? (
                          <>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                              Read from image vs. record
                            </div>
                            <table className="mt-2 w-full text-[13px]">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
                                  <th className="pb-1 text-left font-medium">Field</th>
                                  <th className="pb-1 text-left font-medium">On file</th>
                                  <th className="pb-1 text-left font-medium">Read</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparisons.map((row) => (
                                  <tr key={row.label} className="border-t border-edge">
                                    <td className="py-1.5 text-ink-soft">{row.label}</td>
                                    <td className="numeric py-1.5 text-ink-faint">
                                      {row.onFile ?? '—'}
                                    </td>
                                    <td
                                      className={`numeric py-1.5 font-medium ${
                                        row.conflict ? 'text-critical' : 'text-ink'
                                      }`}
                                    >
                                      {row.extracted ?? '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div className="mt-2.5 text-[13px] text-ink-soft">
                              Identified as{' '}
                              <span className="text-ink">
                                {DOCUMENT_TYPE_LABELS[
                                  fields.documentType as DetectedDocumentType
                                ] ?? fields.documentType}
                              </span>
                              {fields.issuedTo ? ` · issued to ${fields.issuedTo}` : ''}
                            </div>

                            {fields.notes && (
                              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
                                {fields.notes}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[13px] leading-relaxed text-ink-soft">
                            {doc.extractionNote ??
                              'Not read automatically — queued for manual review.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </Section>

        <Section title="What is not implemented">
          <Card className="px-5 py-4">
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <span className="font-medium text-ink">Confirming does not write back yet.</span>{' '}
                The review screen shows the comparison; applying an extracted value to the
                credential record — and letting the rules engine recompute from it — is the next
                step.
              </li>
              <li>
                <span className="font-medium text-ink">No authentication.</span> Uploaded documents
                are served through a route handler rather than a public directory, which is where
                a staff session check belongs. There is none in this demo.
              </li>
              <li>
                <span className="font-medium text-ink">Local disk storage.</span> Files are written
                under <span className="numeric">.uploads/</span>. The storage interface is one
                file, so swapping in object storage does not touch anything above it.
              </li>
            </ul>
          </Card>
        </Section>
      </div>
    </>
  )
}
