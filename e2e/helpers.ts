import { execFileSync } from 'node:child_process'

/**
 * Read a value straight out of Postgres.
 *
 * The portal token is generated at seed time, so a test cannot hardcode it —
 * and asserting against the database is the only way to know the UI is showing
 * what is actually stored rather than something it made up.
 */
export function sql(query: string): string {
  return execFileSync(
    'docker',
    ['exec', 'compliance-radar-db', 'psql', '-U', 'radar', '-d', 'compliance_radar', '-tA', '-c', query],
    { encoding: 'utf8' },
  ).trim()
}

/** The showcase carrier — the one with the hand-tuned dependency chain. */
export const SHOWCASE_DOT = '3421569'

export function showcaseToken(): string {
  const token = sql(`SELECT "portalToken" FROM "Carrier" WHERE "dotNumber"='${SHOWCASE_DOT}';`)
  if (!token) throw new Error('No portal token — has the database been seeded?')
  return token
}

export function outstandingRequestId(): string {
  const id = sql(
    `SELECT d.id FROM "Document" d
       JOIN "Carrier" c ON c.id = d."carrierId"
      WHERE c."dotNumber"='${SHOWCASE_DOT}' AND d.status='REQUESTED'
      ORDER BY d."expiresOn" LIMIT 1;`,
  )
  if (!id) throw new Error('No outstanding document request to test against.')
  return id
}
