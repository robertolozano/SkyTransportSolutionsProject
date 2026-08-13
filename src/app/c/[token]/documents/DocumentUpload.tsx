'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitDocument } from '../actions'

/**
 * Document capture.
 *
 * `capture="environment"` opens the rear camera directly on a phone, so the whole
 * interaction is: tap, photograph, done. No login, no app, no file browser — the
 * reason document collection stalls is friction at exactly this step.
 *
 * Images are downscaled in the browser before upload. A modern phone camera
 * produces 4–12 MB per shot; the text on a compliance document is perfectly
 * legible at 1600px, and on truck-stop signal the difference is the difference
 * between the upload finishing and the driver giving up.
 */

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 2_000_000) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) return file

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

export function DocumentUpload({
  token,
  documentId,
  label,
}: {
  token: string
  documentId: string
  label: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setBusy(true)
    setPreview(URL.createObjectURL(file))

    try {
      const prepared = await downscale(file)
      const formData = new FormData()
      formData.append('file', prepared)

      const result = await submitDocument(token, documentId, formData)
      if (!result.ok) {
        setError(result.message)
        setPreview(null)
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      setError('That didn’t send. Check your signal and try again.')
      setPreview(null)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const working = busy || pending

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
        aria-label={`Photograph ${label}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() => inputRef.current?.click()}
          className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {working ? 'Sending…' : 'Take photo'}
        </button>
        {working && (
          <span className="text-[13px] text-ink-faint">
            Reading the document — this takes a few seconds.
          </span>
        )}
      </div>

      {preview && working && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="mt-3 max-h-40 rounded-md border border-edge opacity-60"
        />
      )}

      {error && (
        <p className="mt-2 text-[13px] text-critical">
          {error}
        </p>
      )}
    </div>
  )
}
