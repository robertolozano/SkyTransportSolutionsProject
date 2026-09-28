'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { storeUpload } from '@/server/storage'
import { isDemoCarrier } from '@/server/demo'
import { readBack, type ReadBack } from '@/server/readBack'
import {
  detectMediaType,
  extractDocument,
  extractionConfigured,
  isSupportedMedia,
  MAX_IMAGE_BYTES,
  PDF_MEDIA,
} from '@/server/extract'

/**
 * Document submission.
 *
 * A Server Action rather than a REST endpoint: the only caller is the upload form
 * on the client page, so there is no reason to define and defend a public route.
 *
 * The order matters — store first, extract second. If extraction fails for any
 * reason, the client's document is already safe and the request is satisfied;
 * a human reads it. Extraction failing must never mean the driver has to
 * photograph the document again.
 */

export interface UploadResult {
  ok: boolean
  documentId?: string
  message: string
  /** What the parser read, for showing straight back in the upload card. */
  read?: ReadBack
  /**
   * Showcase account: the card shows the result in place instead of refreshing,
   * and the next page load puts the request back (see `ensureDemoRequest`).
   */
  demo?: boolean
}

export async function submitDocument(
  token: string,
  documentId: string,
  formData: FormData,
): Promise<UploadResult> {
  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    select: { id: true, dotNumber: true },
  })
  if (!carrier) return { ok: false, message: 'This link is no longer valid.' }

  // The document must belong to this carrier — the token authorises one account,
  // not any document id someone happens to know.
  const document = await prisma.document.findFirst({
    where: { id: documentId, carrierId: carrier.id },
    include: { credential: true },
  })
  if (!document) return { ok: false, message: 'That request could not be found.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'No photo was attached.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'That file is too large. Try again with a smaller photo.' }
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  // Identify by content, not by the browser's claim. `file.type` is derived from
  // the extension, so it is empty for an extension-less file and forgeable in any
  // case — sniffing the magic number is both more permissive for real users and
  // stricter against a bad one.
  const mediaType = detectMediaType(bytes)
  if (!mediaType || !isSupportedMedia(mediaType)) {
    return { ok: false, message: 'Please send a photo (JPEG, PNG, WebP) or a PDF.' }
  }

  const stored = await storeUpload(carrier.id, file.name || 'upload', bytes, mediaType)

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status: 'RECEIVED',
      fileName: file.name || 'upload',
      storagePath: stored.storagePath,
      mimeType: mediaType,
      sizeBytes: stored.sizeBytes,
      uploadedAt: new Date(),
      // A PDF always has a parser available; an image needs the vision model.
      extractionStatus:
        mediaType === PDF_MEDIA || extractionConfigured() ? 'PENDING' : 'UNAVAILABLE',
    },
  })

  const result = await extractDocument(bytes, mediaType, document.type)

  if (result.status === 'EXTRACTED') {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: 'EXTRACTED',
        detectedType: result.fields.documentType,
        extractedFields: result.fields as unknown as object,
        confidence: result.fields.confidence,
        extractionMethod: result.method,
        extractionNote: result.fields.notes ?? result.note ?? null,
        extractedAt: new Date(),
      },
    })
  } else {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: result.status,
        extractionMethod: 'method' in result ? (result.method ?? null) : null,
        extractionNote: result.note,
        extractedAt: new Date(),
      },
    })
  }

  const demo = isDemoCarrier(carrier)

  // Revalidating re-renders the page in this same response, and on the showcase
  // account that render would immediately put the request back — replacing the
  // card that is about to show what was read. There, the reload does it instead.
  if (!demo) {
    revalidatePath(`/c/${token}`)
    revalidatePath(`/c/${token}/documents`)
  }

  return {
    ok: true,
    documentId: document.id,
    read: result.status === 'EXTRACTED' ? readBack(result.fields) : undefined,
    demo,
    message:
      result.status === 'EXTRACTED'
        ? 'Got it — we read the document and our team will confirm the details.'
        : 'Got it. Your document is with our team.',
  }
}
