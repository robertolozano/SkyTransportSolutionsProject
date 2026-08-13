import { prisma } from '@/server/db'
import { generateSampleDocument, sampleSpecFor } from '@/server/pdfTemplate'

/**
 * Download a sample document for a specific outstanding request.
 *
 * Generated per request rather than served as a static file, so the sample
 * carries that request's actual subject and identifier — which means uploading
 * it exercises reconciliation against the real record instead of matching
 * nothing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      carrier: true,
      credential: { include: { truck: true, driver: true } },
    },
  })
  if (!document) return new Response('Not found', { status: 404 })

  const subject = document.credential?.driver
    ? `${document.credential.driver.firstName} ${document.credential.driver.lastName}`
    : document.credential?.truck
      ? `${document.carrier.legalName} — Unit ${document.credential.truck.unitNumber}`
      : document.carrier.legalName

  const spec = sampleSpecFor(
    document.type,
    subject,
    document.credential?.identifier ?? null,
    document.credential?.expiresOn ?? null,
    document.carrier.baseState,
  )

  const bytes = await generateSampleDocument(spec)
  const fileName = `sample-${document.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
