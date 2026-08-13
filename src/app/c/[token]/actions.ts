'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/server/db'
import { storeUpload } from '@/server/storage'
import {
  extractDocument,
  extractionConfigured,
  isSupportedMedia,
  MAX_IMAGE_BYTES,
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
}

export async function submitDocument(
  token: string,
  documentId: string,
  formData: FormData,
): Promise<UploadResult> {
  const carrier = await prisma.carrier.findUnique({
    where: { portalToken: token },
    select: { id: true },
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
    return { ok: false, message: 'That image is too large. Try again with a smaller photo.' }
  }
  if (!isSupportedMedia(file.type)) {
    return { ok: false, message: 'Please send a photo (JPEG, PNG, or WebP).' }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const stored = await storeUpload(carrier.id, file.name || 'upload.jpg', bytes)

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status: 'RECEIVED',
      fileName: file.name || 'upload.jpg',
      storagePath: stored.storagePath,
      mimeType: file.type,
      sizeBytes: stored.sizeBytes,
      uploadedAt: new Date(),
      extractionStatus: extractionConfigured() ? 'PENDING' : 'UNAVAILABLE',
    },
  })

  const result = await extractDocument(bytes.toString('base64'), file.type, document.type)

  if (result.status === 'EXTRACTED') {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: 'EXTRACTED',
        detectedType: result.fields.documentType,
        extractedFields: result.fields as unknown as object,
        confidence: result.fields.confidence,
        extractionNote: result.fields.notes,
        extractedAt: new Date(),
      },
    })
  } else {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        extractionStatus: result.status,
        extractionNote: result.note,
        extractedAt: new Date(),
      },
    })
  }

  revalidatePath(`/c/${token}`)
  revalidatePath(`/c/${token}/documents`)

  return {
    ok: true,
    documentId: document.id,
    message:
      result.status === 'EXTRACTED'
        ? 'Got it — we read the document and our team will confirm the details.'
        : 'Got it. Your document is with our team.',
  }
}
