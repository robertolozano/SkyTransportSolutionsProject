import { prisma } from '@/server/db'
import { readUpload } from '@/server/storage'

/**
 * Serve an uploaded document image.
 *
 * A route handler because an <img> tag is a non-React consumer. Files are stored
 * outside `public/`, so this is the only path to them — in a real deployment this
 * is where the staff session check goes. There is no auth in this demo, which is
 * stated rather than glossed over.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    select: { storagePath: true, mimeType: true, fileName: true },
  })
  if (!document?.storagePath) return new Response('Not found', { status: 404 })

  const bytes = await readUpload(document.storagePath)
  if (!bytes) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': document.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName)}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
