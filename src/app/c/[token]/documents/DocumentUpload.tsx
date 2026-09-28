'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitDocument, type UploadResult } from '../actions'
import { WhatWeRead } from './WhatWeRead'

/**
 * Document capture.
 *
 * Two routes in, because the right one depends entirely on where the user is:
 *
 *  - **Camera** — `getUserMedia`, so it opens a live viewfinder on a laptop too.
 *    The `capture` attribute alone only opens the camera on mobile; on desktop
 *    the browser silently ignores it and shows a file dialog, which is what made
 *    the button look broken.
 *  - **Choose file** — the fallback that always works, and the route for a PDF
 *    the client already has.
 *
 * Photographs are downscaled in the browser first: a phone camera produces
 * 4–12 MB per shot, the text on a compliance document is legible at 1600px, and
 * on truck-stop signal that difference decides whether the upload finishes.
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
  demo = false,
}: {
  token: string
  documentId: string
  label: string
  /** Showcase account — show the parse result in place; a reload re-requests it. */
  demo?: boolean
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [sent, setSent] = useState<UploadResult | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  // Release the camera if the component unmounts while it is open.
  useEffect(() => () => stopCamera(), [stopCamera])

  async function openCamera() {
    setError(null)
    setCameraError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser will not open the camera. Use “Choose file” instead.')
      return
    }

    try {
      // Prefer the rear camera on a phone; a laptop simply ignores the hint.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
      // The <video> only exists once the panel renders.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow it in your browser, or use “Choose file”.'
          : name === 'NotFoundError'
            ? 'No camera found on this device. Use “Choose file” instead.'
            : 'The camera could not be opened. Use “Choose file” instead.',
      )
    }
  }

  async function shoot() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    stopCamera()
    if (!blob) {
      setError('That photo could not be captured. Try again.')
      return
    }
    await send(new File([blob], 'capture.jpg', { type: 'image/jpeg' }))
  }

  async function send(file: File) {
    setError(null)
    setBusy(true)
    try {
      const prepared = await downscale(file)
      const formData = new FormData()
      formData.append('file', prepared)

      const result = await submitDocument(token, documentId, formData)
      if (!result.ok) setError(result.message)
      else if (result.demo) setSent(result)
      else startTransition(() => router.refresh())
    } catch {
      setError('That didn’t send. Check your connection and try again.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const working = busy || pending

  if (sent) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-good-edge bg-good-soft px-4 py-3">
          <div className="text-[14px] font-medium text-ink">Received</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{sent.message}</p>
        </div>
        {sent.read && <WhatWeRead {...sent.read} />}
        {demo && (
          <p className="text-[12px] text-ink-faint">
            Demo account — refresh the page and this request comes back, ready to send again.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void send(file)
        }}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {cameraOpen ? (
        <div className="rounded-lg border border-edge bg-ink/5 p-2">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-md bg-black"
            style={{ maxHeight: 320 }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shoot}
              className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-md border border-edge-strong px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">
            Fill the frame with the document and keep all four corners visible.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={working}
            onClick={openCamera}
            className="rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {working ? 'Sending…' : 'Open camera'}
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-edge-strong px-4 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-60"
          >
            Choose file
          </button>
        </div>
      )}

      {working && (
        <p className="mt-2 text-[13px] text-ink-faint">Reading the document…</p>
      )}
      {cameraError && <p className="mt-2 text-[13px] text-medium">{cameraError}</p>}
      {error && <p className="mt-2 text-[13px] text-critical">{error}</p>}
    </div>
  )
}
