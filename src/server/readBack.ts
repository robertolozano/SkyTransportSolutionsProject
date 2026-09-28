import { DOCUMENT_TYPE_LABELS, type ExtractedFields } from './extract'

export interface ReadBack {
  rows: Array<{ label: string; value: string }>
  note: string
}

/**
 * What the parser read, phrased for the carrier.
 *
 * Built on the server — the labels live beside the extraction code, which pulls
 * in the model SDK — and shared by the "Already sent" list and the confirmation
 * shown right after an upload, so both always say the same thing.
 */
export function readBack(fields: ExtractedFields): ReadBack {
  const rows: ReadBack['rows'] = []
  if (fields.documentType) {
    rows.push({
      label: 'Document',
      value: DOCUMENT_TYPE_LABELS[fields.documentType] ?? fields.documentType,
    })
  }
  if (fields.issuedTo) rows.push({ label: 'Issued to', value: fields.issuedTo })
  if (fields.identifier) rows.push({ label: 'Number', value: fields.identifier })
  if (fields.expiresOn) rows.push({ label: 'Expires', value: fields.expiresOn })

  const note =
    (fields.confidence === 'low'
      ? 'Some of this was hard to read, so a person on our team is checking it.'
      : 'Our team confirms these details before anything is filed.') +
    (fields.notes ? ` ${fields.notes}` : '')

  return { rows, note }
}
