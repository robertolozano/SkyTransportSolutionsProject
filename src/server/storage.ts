import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { prisma } from './db'

/**
 * Uploaded-file storage.
 *
 * Bytes live in Postgres. The obvious implementation — write to a directory —
 * works locally and fails silently on a serverless host, where the filesystem is
 * read-only outside a scratch directory that does not survive the request. That
 * failure would land on the document upload, which is the feature this product
 * is most likely to be judged on.
 *
 * At real volume the answer is object storage (S3, Vercel Blob) with a signed
 * URL. At this size — documents capped at 5 MB, a handful per carrier — a table
 * keeps the system self-contained with nothing extra to provision, and the
 * interface below is the only thing that would change.
 *
 * That interface is deliberately two functions with no leaked details: callers
 * hand over bytes and get back an opaque key, which is why moving from disk to
 * Postgres touched this file and nothing else.
 */

export interface StoredFile {
  storagePath: string
  sizeBytes: number
}

/** Never let a client-supplied value become part of a stored identifier. */
function safeSegment(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export async function storeUpload(
  carrierId: string,
  fileName: string,
  bytes: Buffer,
  mimeType?: string,
): Promise<StoredFile> {
  // The extension is cosmetic — it makes keys readable in the database without
  // being trusted for anything. Content type is decided by sniffing the bytes.
  const ext = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8)
  const key = `${safeSegment(carrierId)}/${randomUUID()}${ext}`

  await prisma.uploadBlob.create({
    // Prisma's Bytes maps to Uint8Array; a Buffer is one, but its backing store
    // is typed loosely enough that the compiler will not accept it directly.
    data: { key, bytes: new Uint8Array(bytes), mimeType: mimeType ?? null },
  })

  return { storagePath: key, sizeBytes: bytes.byteLength }
}

export async function readUpload(storagePath: string): Promise<Buffer | null> {
  if (!storagePath) return null

  const blob = await prisma.uploadBlob.findUnique({
    where: { key: storagePath },
    select: { bytes: true },
  })
  if (!blob) return null

  return Buffer.from(blob.bytes)
}

/** Remove a stored blob. Used when a document is superseded or deleted. */
export async function deleteUpload(storagePath: string): Promise<void> {
  await prisma.uploadBlob.deleteMany({ where: { key: storagePath } })
}
