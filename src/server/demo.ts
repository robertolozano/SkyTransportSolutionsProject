import { prisma } from './db'
import { deleteUpload } from './storage'

/** The showcase carrier — the account every demo walks through. */
export const DEMO_DOT = '3421569'

export function isDemoCarrier(carrier: { dotNumber: string }): boolean {
  return carrier.dotNumber === DEMO_DOT
}

/**
 * Keep the document loop demonstrable on the showcase account.
 *
 * Uploading satisfies a request, so after one demo there is nothing left to
 * upload against. Called on every portal render: if the showcase carrier has no
 * outstanding request, the most recently received document is requested again,
 * so a page refresh always puts one back. Older receipts of that same document
 * are pruned first, so repeated demos don't pile up under "Already sent".
 *
 * Every other carrier is untouched — this is a demo affordance, not behaviour.
 *
 * A layout and its page render in parallel and both read documents, so each
 * calls this; concurrent calls share one run rather than each creating a request.
 */
export function ensureDemoRequest(token: string): Promise<void> {
  let run = inflight.get(token)
  if (!run) {
    run = restoreRequest(token).finally(() => inflight.delete(token))
    inflight.set(token, run)
  }
  return run
}

const inflight = new Map<string, Promise<void>>()

async function restoreRequest(token: string) {
  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    select: { id: true, dotNumber: true },
  })
  if (!carrier || !isDemoCarrier(carrier)) return

  const outstanding = await prisma.document.count({
    where: { carrierId: carrier.id, status: 'REQUESTED' },
  })
  if (outstanding > 0) return

  const latest = await prisma.document.findFirst({
    where: { carrierId: carrier.id, status: 'RECEIVED' },
    orderBy: [{ uploadedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  if (!latest) return

  const superseded = await prisma.document.findMany({
    where: {
      carrierId: carrier.id,
      status: 'RECEIVED',
      type: latest.type,
      credentialId: latest.credentialId,
      id: { not: latest.id },
    },
    select: { id: true, storagePath: true },
  })
  for (const doc of superseded) await deleteUpload(doc.storagePath)
  await prisma.document.deleteMany({ where: { id: { in: superseded.map((d) => d.id) } } })

  await prisma.document.create({
    data: {
      carrierId: carrier.id,
      credentialId: latest.credentialId,
      type: latest.type,
      fileName: '',
      storagePath: '',
      status: 'REQUESTED',
      requestedAt: new Date(),
      expiresOn: latest.expiresOn,
    },
  })
}
