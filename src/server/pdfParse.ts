import { extractText, getDocumentProxy } from 'unpdf'
import type { DetectedDocumentType, ExtractedFields } from './extract'

/**
 * Deterministic PDF field extraction.
 *
 * This is the demonstration path, and it is worth being precise about what it
 * is and is not. It reads the text layer of a PDF and pulls fields by their
 * printed labels. That works because the documents it is aimed at — issued
 * certificates, cab cards, insurance binders — are generated, not handwritten,
 * and carry a consistent label vocabulary.
 *
 * What it cannot do is the actual job: a driver photographs a medical card at a
 * truck stop, and a photograph has no text layer. Reading that needs vision.
 * The vision path lives in `extract.ts` and is what a production deployment
 * runs; this parser exists so the pipeline can be demonstrated end to end
 * without credentials, and because a deterministic parser is genuinely the
 * right tool for the subset of documents that do arrive as generated PDFs.
 *
 * The two paths return the same shape, so everything downstream — reconciliation,
 * review, the client's "what we read" panel — is identical either way.
 */

/** Label variants seen across the document types this handles. */
const FIELD_PATTERNS: Record<keyof ParsedLabels, RegExp[]> = {
  issuedTo: [
    /(?:driver|registrant|insured|issued\s*to|name)\s*(?:name)?\s*[:\-]\s*(.+)/i,
    /(?:carrier|company)\s*name\s*[:\-]\s*(.+)/i,
  ],
  identifier: [
    /(?:certificate|licen[cs]e|policy|plate|document|registration)\s*(?:no\.?|number|#)\s*[:\-]\s*(.+)/i,
    /\b(?:vin)\s*[:\-]\s*([A-HJ-NPR-Z0-9]{11,17})/i,
  ],
  issuedOn: [/(?:issue|issued|effective)\s*(?:date)?\s*[:\-]\s*(.+)/i],
  expiresOn: [
    /(?:expiration|expires?|expiry|valid\s*(?:thru|through|until))\s*(?:date)?\s*[:\-]\s*(.+)/i,
  ],
  issuingAuthority: [
    /(?:issuing\s*authority|issued\s*by|jurisdiction|agency)\s*[:\-]\s*(.+)/i,
  ],
}

interface ParsedLabels {
  issuedTo: string | null
  identifier: string | null
  issuedOn: string | null
  expiresOn: string | null
  issuingAuthority: string | null
}

/** Title text → document type. Ordered, first match wins. */
const TYPE_SIGNATURES: Array<[RegExp, DetectedDocumentType]> = [
  [/medical\s+examiner|medical\s+certificate|dot\s+physical/i, 'MEDICAL_CERTIFICATE'],
  [/apportioned|cab\s*card|international\s+registration/i, 'APPORTIONED_REGISTRATION'],
  [/schedule\s*1|heavy\s+(?:highway\s+)?vehicle\s+use\s+tax|form\s*2290/i, 'HVUT_SCHEDULE_1'],
  [/certificate\s+of\s+insurance|liability\s+insurance/i, 'INSURANCE_CERTIFICATE'],
  [/clean\s+truck\s+check|emissions?\s+compliance/i, 'EMISSIONS_CERTIFICATE'],
  [/motor\s+carrier\s+permit/i, 'MOTOR_CARRIER_PERMIT'],
  [/commercial\s+driver|cdl/i, 'COMMERCIAL_DRIVERS_LICENSE'],
]

/**
 * Normalise a printed date to ISO.
 *
 * Returns null on anything ambiguous rather than picking an interpretation —
 * the same rule the vision prompt is given, for the same reason: a wrong expiry
 * date silently moves a compliance deadline.
 */
export function normaliseDate(raw: string): string | null {
  const value = raw.trim().replace(/[.,;]$/, '')

  // Already ISO.
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return value

  // Month name forms: "March 14, 2027" / "14 March 2027".
  const named = Date.parse(value)
  if (/[A-Za-z]{3,}/.test(value) && !Number.isNaN(named)) {
    return new Date(named).toISOString().slice(0, 10)
  }

  // Numeric slash/dash forms. US documents are MM/DD/YYYY, but a day above 12
  // in the first position means the writer used DD/MM — and if BOTH positions
  // are 12 or below there is no way to tell, so refuse.
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (numeric) {
    const [, a, b, y] = numeric
    const first = Number(a)
    const second = Number(b)
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)

    if (first > 12 && second <= 12) {
      return `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`
    }
    if (first <= 12 && second > 12) {
      return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`
    }
    if (first <= 12 && second <= 12) return null // genuinely ambiguous
  }

  return null
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      // Labels sit on their own line in a generated PDF; take the line only.
      const value = match[1].split('\n')[0].trim()
      if (value) return value
    }
  }
  return null
}

export interface PdfParseOutcome {
  ok: boolean
  fields?: ExtractedFields
  note: string
  /** Raw text, so a reviewer can see exactly what the parser had to work with. */
  text?: string
}

export async function parsePdfDocument(bytes: Buffer): Promise<PdfParseOutcome> {
  let text: string
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const extracted = await extractText(pdf, { mergePages: true })
    text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text
  } catch (error) {
    return {
      ok: false,
      note: `The PDF could not be read (${error instanceof Error ? error.message : 'unknown error'}).`,
    }
  }

  if (!text.trim()) {
    // A scanned PDF is an image in a PDF wrapper — no text layer to read.
    return {
      ok: false,
      note: 'This PDF has no text layer, which usually means it is a scan. Reading it needs the vision model rather than the text parser.',
      text: '',
    }
  }

  const labels: ParsedLabels = {
    issuedTo: firstMatch(text, FIELD_PATTERNS.issuedTo),
    identifier: firstMatch(text, FIELD_PATTERNS.identifier),
    issuedOn: firstMatch(text, FIELD_PATTERNS.issuedOn),
    expiresOn: firstMatch(text, FIELD_PATTERNS.expiresOn),
    issuingAuthority: firstMatch(text, FIELD_PATTERNS.issuingAuthority),
  }

  const documentType =
    TYPE_SIGNATURES.find(([pattern]) => pattern.test(text))?.[1] ?? 'OTHER'

  const expiresOn = labels.expiresOn ? normaliseDate(labels.expiresOn) : null
  const issuedOn = labels.issuedOn ? normaliseDate(labels.issuedOn) : null

  // Confidence reflects what was actually found, not how the parser feels.
  const unreadable: string[] = []
  if (labels.expiresOn && !expiresOn) unreadable.push(`expiry date "${labels.expiresOn}" is ambiguous`)
  if (labels.issuedOn && !issuedOn) unreadable.push(`issue date "${labels.issuedOn}" is ambiguous`)
  if (!labels.expiresOn) unreadable.push('no expiration date label found')
  if (documentType === 'OTHER') unreadable.push('document type not recognised from the heading')

  const confidence: ExtractedFields['confidence'] =
    !expiresOn || documentType === 'OTHER' ? 'low' : unreadable.length > 0 ? 'medium' : 'high'

  return {
    ok: true,
    text,
    note: 'Read from the PDF text layer by the deterministic parser.',
    fields: {
      documentType,
      issuedTo: labels.issuedTo,
      identifier: labels.identifier,
      issuedOn,
      expiresOn,
      issuingAuthority: labels.issuingAuthority,
      confidence,
      notes: unreadable.length > 0 ? unreadable.join('; ') + '.' : null,
    },
  }
}
