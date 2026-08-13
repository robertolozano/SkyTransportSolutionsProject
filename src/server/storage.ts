import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Uploaded-file storage.
 *
 * Local disk, deliberately: a demo should not require an object-store account to
 * run. The interface is the part that matters — swapping this for S3 is one file,
 * because nothing above it knows where bytes live.
 *
 * Files are written outside `public/` and served through a route handler, so a
 * client document is never reachable just by guessing a URL.
 */

const UPLOAD_ROOT = path.join(process.cwd(), '.uploads')

function safeSegment(value: string): string {
  // Never let a client-supplied name reach the filesystem. Hash it instead.
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

export interface StoredFile {
  storagePath: string
  sizeBytes: number
}

export async function storeUpload(
  carrierId: string,
  fileName: string,
  bytes: Buffer,
): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, safeSegment(carrierId))
  await mkdir(dir, { recursive: true })

  const ext = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin'
  const key = `${randomUUID()}${ext}`
  await writeFile(path.join(dir, key), bytes)

  // Store the relative key; the absolute root is an implementation detail.
  return {
    storagePath: path.join(safeSegment(carrierId), key),
    sizeBytes: bytes.byteLength,
  }
}

export async function readUpload(storagePath: string): Promise<Buffer | null> {
  // Resolve and confirm the result is still inside the upload root — a stored path
  // should never be able to escape it, but this is the check that guarantees it.
  const resolved = path.resolve(UPLOAD_ROOT, storagePath)
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) return null

  try {
    return await readFile(resolved)
  } catch {
    return null
  }
}
