import { describe, expect, it } from 'vitest'
import { normaliseDate, parsePdfDocument } from './pdfParse'
import { generateSampleDocument, sampleSpecFor } from './pdfTemplate'
import { extractDocument } from './extract'

/**
 * The document-reading path.
 *
 * The date tests carry the most weight here. A parser that guesses at
 * `03/04/2027` will be right about half the time, and the half it gets wrong
 * silently moves a compliance deadline — which is the exact failure the whole
 * product exists to prevent. Refusing is the correct behaviour, so it is pinned.
 */

describe('date normalisation', () => {
  it('passes ISO through unchanged', () => {
    expect(normaliseDate('2027-03-14')).toBe('2027-03-14')
  })

  it('reads month-name forms', () => {
    expect(normaliseDate('March 14, 2027')).toBe('2027-03-14')
    expect(normaliseDate('14 March 2027')).toBe('2027-03-14')
  })

  it('resolves numeric dates when only one reading is possible', () => {
    // 25 cannot be a month, so this is unambiguously DD/MM.
    expect(normaliseDate('25/03/2027')).toBe('2027-03-25')
    // 25 cannot be a month, so this is unambiguously MM/DD.
    expect(normaliseDate('03/25/2027')).toBe('2027-03-25')
  })

  it('refuses a genuinely ambiguous date rather than guessing', () => {
    // Could be 3 April or 4 March. Half the guesses would be wrong.
    expect(normaliseDate('03/04/2027')).toBeNull()
    expect(normaliseDate('01/02/27')).toBeNull()
  })

  it('refuses unparseable text', () => {
    expect(normaliseDate('sometime next spring')).toBeNull()
    expect(normaliseDate('')).toBeNull()
  })

  it('trims trailing punctuation from a printed field', () => {
    expect(normaliseDate('2027-03-14.')).toBe('2027-03-14')
  })
})

describe('generated sample documents round-trip', () => {
  const cases = [
    ["Medical examiner's certificate", 'MEDICAL_CERTIFICATE'],
    ['Apportioned registration (cab card)', 'APPORTIONED_REGISTRATION'],
    ['Certificate of insurance', 'INSURANCE_CERTIFICATE'],
  ] as const

  for (const [requested, expectedType] of cases) {
    it(`recovers every field from a generated ${expectedType}`, async () => {
      const spec = sampleSpecFor(requested, 'Miguel Reyes', 'ME-448120', new Date('2026-09-26'), 'CA')
      const bytes = Buffer.from(await generateSampleDocument(spec))

      const outcome = await parsePdfDocument(bytes)
      expect(outcome.ok).toBe(true)

      const fields = outcome.fields!
      expect(fields.documentType).toBe(expectedType)
      expect(fields.issuedTo).toBe(spec.issuedTo)
      expect(fields.identifier).toBe(spec.identifier)
      expect(fields.expiresOn).toBe(spec.expiresOn.toISOString().slice(0, 10))
      expect(fields.issuingAuthority).toBe(spec.issuingAuthority)
      expect(fields.confidence).toBe('high')
      expect(fields.notes).toBeNull()
    })
  }

  it('renews the expiry forward from the date on file', async () => {
    const onFile = new Date('2026-09-26')
    const spec = sampleSpecFor("Medical examiner's certificate", 'A B', 'X', onFile, 'CA')
    // A client sends the *replacement* document, so its expiry must be later than
    // the record's — otherwise reconciliation has nothing to show.
    expect(spec.expiresOn.getTime()).toBeGreaterThan(onFile.getTime())
  })
})

describe('extraction dispatch', () => {
  it('reads a PDF with no model credentials', async () => {
    const spec = sampleSpecFor("Medical examiner's certificate", 'Ada Vance', 'ME-1', null, 'CA')
    const bytes = Buffer.from(await generateSampleDocument(spec))

    const result = await extractDocument(bytes, 'application/pdf')
    expect(result.status).toBe('EXTRACTED')
    expect(result.status === 'EXTRACTED' && result.method).toBe('PDF_TEXT')
  })

  it('reports an unreadable file rather than returning empty fields', async () => {
    const notAPdf = Buffer.from('this is not a pdf', 'utf8')
    const outcome = await parsePdfDocument(notAPdf)
    expect(outcome.ok).toBe(false)
    expect(outcome.fields).toBeUndefined()
    expect(outcome.note.length).toBeGreaterThan(0)
  })

  it('rejects an unsupported file type', async () => {
    const result = await extractDocument(Buffer.from('x'), 'text/html')
    expect(result.status).toBe('FAILED')
  })
})
