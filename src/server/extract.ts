import Anthropic from '@anthropic-ai/sdk'

/**
 * Document extraction.
 *
 * A driver photographs a medical card at a truck stop; this reads the document
 * type, the identifiers, and — the field that actually matters — the expiry date,
 * so the credential record updates without anyone retyping it.
 *
 * Three deliberate choices:
 *
 *  1. **Extraction proposes, it does not commit.** The result lands on the Document
 *     row for a human to confirm before any Credential is updated. An expiry date
 *     read wrong from a blurry photo would silently move a compliance deadline —
 *     that is exactly the failure this whole product exists to prevent.
 *  2. **Confidence and unreadable fields are surfaced, not hidden.** The model is
 *     told to return null and say so rather than guess.
 *  3. **No credentials means no extraction, not fake extraction.** With nothing
 *     configured the upload still succeeds and the document is queued for manual
 *     review, clearly marked.
 */

/** Document types the system knows how to file against a credential. */
export const DOCUMENT_TYPES = [
  'MEDICAL_CERTIFICATE',
  'COMMERCIAL_DRIVERS_LICENSE',
  'APPORTIONED_REGISTRATION',
  'INSURANCE_CERTIFICATE',
  'HVUT_SCHEDULE_1',
  'EMISSIONS_CERTIFICATE',
  'MOTOR_CARRIER_PERMIT',
  'OTHER',
] as const

export type DetectedDocumentType = (typeof DOCUMENT_TYPES)[number]

export interface ExtractedFields {
  documentType: DetectedDocumentType
  /** Person or company the document is issued to. */
  issuedTo: string | null
  /** Licence, policy, plate, or VIN — whatever identifies the subject. */
  identifier: string | null
  /** ISO date, or null when not present or not legible. */
  issuedOn: string | null
  /** ISO date. The field the compliance engine actually consumes. */
  expiresOn: string | null
  issuingAuthority: string | null
  confidence: 'high' | 'medium' | 'low'
  /** What was unreadable, ambiguous, or looked wrong. */
  notes: string | null
}

export type ExtractionResult =
  | { status: 'EXTRACTED'; fields: ExtractedFields }
  | { status: 'UNAVAILABLE'; note: string }
  | { status: 'FAILED'; note: string }

/** JSON Schema for structured output — the model cannot return a different shape. */
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string',
      enum: [...DOCUMENT_TYPES],
      description: 'The kind of compliance document shown in the image.',
    },
    issuedTo: {
      type: ['string', 'null'],
      description: 'Full name of the driver, or legal name of the company, the document is issued to.',
    },
    identifier: {
      type: ['string', 'null'],
      description:
        'The document number: licence number, policy number, plate number, or VIN. Null if not visible.',
    },
    issuedOn: {
      type: ['string', 'null'],
      description: 'Issue date as YYYY-MM-DD. Null if absent or illegible.',
    },
    expiresOn: {
      type: ['string', 'null'],
      description:
        'Expiration date as YYYY-MM-DD. This is the most important field. Null if absent or illegible — do not infer it from the issue date.',
    },
    issuingAuthority: {
      type: ['string', 'null'],
      description: 'Agency, state, or company that issued the document.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'high: every field read cleanly. medium: legible but some fields uncertain. low: image quality or framing makes the reading unreliable.',
    },
    notes: {
      type: ['string', 'null'],
      description:
        'What was unreadable, cut off, ambiguous, or inconsistent. Null if the document read cleanly.',
    },
  },
  required: [
    'documentType',
    'issuedTo',
    'identifier',
    'issuedOn',
    'expiresOn',
    'issuingAuthority',
    'confidence',
    'notes',
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You read photographs of US commercial trucking compliance documents and extract their fields.

These are phone photos taken by drivers, so expect glare, skew, partial crops, and poor lighting.

Read only what is visibly present. If a field is missing, cut off, or you cannot read it with confidence, return null for it and say so in notes. Never infer a date from another date, never complete a partially visible number, and never fill a field from what the document type usually contains. A wrong expiry date silently moves a compliance deadline and takes a truck off the road, so a null is always better than a guess.

Dates appear in many formats on these documents. Normalize to YYYY-MM-DD. If a date is genuinely ambiguous — for example 03/04/26 with no other signal about day and month order — return null and explain in notes rather than pick one.

Set confidence to reflect the reading as a whole, and use low freely: it routes the document to a person, which is the correct outcome for a bad photo.`

/** Images beyond this are downscaled client-side before upload. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
export type SupportedMedia = (typeof SUPPORTED_MEDIA)[number]

export function isSupportedMedia(mime: string): mime is SupportedMedia {
  return (SUPPORTED_MEDIA as readonly string[]).includes(mime)
}

/**
 * True when a model is reachable. Checked rather than assumed so the upload path
 * can degrade to manual review instead of failing.
 */
export function extractionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}

export async function extractDocument(
  imageBase64: string,
  mediaType: SupportedMedia,
  expectedType?: string,
): Promise<ExtractionResult> {
  if (!extractionConfigured()) {
    return {
      status: 'UNAVAILABLE',
      note: 'No model credentials configured. The document was stored and queued for manual review.',
    }
  }

  const client = new Anthropic()

  const expectation = expectedType
    ? `\n\nThis was requested as: ${expectedType}. If the image shows something else, report what it actually is — do not force it to match.`
    : ''

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Reading a skewed, glared phone photo benefits from deliberation; the
      // cost is trivial against a mis-read expiry date.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: EXTRACTION_SCHEMA,
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: `Extract the fields from this compliance document.${expectation}`,
            },
          ],
        },
      ],
    })

    // A safety refusal is a successful HTTP response, not an exception.
    if (response.stop_reason === 'refusal') {
      return {
        status: 'FAILED',
        note: 'The model declined to process this image. Queued for manual review.',
      }
    }

    const text = response.content.find((block) => block.type === 'text')
    if (!text || text.type !== 'text') {
      return { status: 'FAILED', note: 'No readable extraction was returned.' }
    }

    const fields = JSON.parse(text.text) as ExtractedFields
    return { status: 'EXTRACTED', fields }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { status: 'FAILED', note: 'Rate limited. The document is stored; retry extraction later.' }
    }
    if (error instanceof Anthropic.APIError) {
      return { status: 'FAILED', note: `Extraction failed (${error.status}). Queued for manual review.` }
    }
    return {
      status: 'FAILED',
      note: error instanceof Error ? error.message : 'Extraction failed for an unknown reason.',
    }
  }
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export interface FieldComparison {
  label: string
  onFile: string | null
  extracted: string | null
  /** True when both are present and disagree — the case a human must adjudicate. */
  conflict: boolean
}

/**
 * Compare what was extracted against what the credential record already says.
 *
 * The interesting output is not the matches — it is the disagreements. A plate
 * that expires a month earlier than the record claims is exactly the drift that
 * puts a truck on the road with a deadline nobody is tracking.
 */
export function compareToCredential(
  fields: ExtractedFields,
  credential: { identifier?: string | null; issuedOn?: Date | null; expiresOn?: Date | null } | null,
): FieldComparison[] {
  const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

  const rows: FieldComparison[] = [
    { label: 'Identifier', onFile: credential?.identifier ?? null, extracted: fields.identifier, conflict: false },
    { label: 'Issued', onFile: iso(credential?.issuedOn), extracted: fields.issuedOn, conflict: false },
    { label: 'Expires', onFile: iso(credential?.expiresOn), extracted: fields.expiresOn, conflict: false },
  ]

  for (const row of rows) {
    row.conflict = Boolean(row.onFile && row.extracted && row.onFile !== row.extracted)
  }
  return rows
}

export const DOCUMENT_TYPE_LABELS: Record<DetectedDocumentType, string> = {
  MEDICAL_CERTIFICATE: "Medical examiner's certificate",
  COMMERCIAL_DRIVERS_LICENSE: 'Commercial driver licence',
  APPORTIONED_REGISTRATION: 'Apportioned registration (cab card)',
  INSURANCE_CERTIFICATE: 'Certificate of insurance',
  HVUT_SCHEDULE_1: 'Stamped Schedule 1 (Form 2290)',
  EMISSIONS_CERTIFICATE: 'Emissions compliance certificate',
  MOTOR_CARRIER_PERMIT: 'Motor carrier permit',
  OTHER: 'Other document',
}
