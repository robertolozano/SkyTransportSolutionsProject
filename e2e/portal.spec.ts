import { expect, test } from '@playwright/test'
import { outstandingRequestId, showcaseToken, sql, SHOWCASE_DOT } from './helpers'

/**
 * The client portal, including the full document loop.
 *
 * The upload test is the one that earns its keep: it downloads a generated
 * sample, posts it back through the Server Action, and asserts the parsed fields
 * reach both the database and the screen. Nothing short of a browser exercises
 * that path.
 */
test.describe('client portal', () => {
  test('tabs render and the document badge matches outstanding requests', async ({ page }) => {
    const token = showcaseToken()
    await page.goto(`/c/${token}`)

    await expect(page.getByRole('heading', { name: /Altamont Freight Systems/ })).toBeVisible()

    const outstanding = sql(
      `SELECT count(*) FROM "Document" d JOIN "Carrier" c ON c.id=d."carrierId"
        WHERE c."dotNumber"='${SHOWCASE_DOT}' AND d.status='REQUESTED';`,
    )
    const documentsTab = page.getByRole('link', { name: /Documents/ })
    await expect(documentsTab).toContainText(outstanding)
  })

  test('nav stays pinned while the deadlines list scrolls', async ({ page }) => {
    await page.goto(`/c/${showcaseToken()}/deadlines`)

    await page.locator('main').evaluate((main) => main.scrollTo(0, 2000))
    await expect(page.getByRole('link', { name: 'Overview' })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toBeInViewport()
  })

  test('client sees no jargon from the staff side', async ({ page }) => {
    await page.goto(`/c/${showcaseToken()}`)
    const body = await page.locator('body').innerText()

    // These belong to the operations console and must not leak to the customer.
    for (const term of ['Revenue at risk', 'Out-of-service date', '49 CFR', 'Membership at risk']) {
      expect(body).not.toContain(term)
    }
  })

  test('switching tabs preserves the account', async ({ page }) => {
    const token = showcaseToken()
    await page.goto(`/c/${token}`)

    await page.getByRole('link', { name: 'Deadlines' }).click()
    await page.waitForURL(`/c/${token}/deadlines`)
    await page.getByRole('link', { name: /Documents/ }).click()
    await page.waitForURL(`/c/${token}/documents`)

    await expect(page.getByRole('heading', { name: /Altamont Freight Systems/ })).toBeVisible()
  })

  test('sample document route serves a real PDF', async ({ request }) => {
    const response = await request.get(`/api/samples/${outstandingRequestId()}`)

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-disposition']).toMatch(/\.pdf"?$/)
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
  })

  test('uploading the sample extracts its fields end to end', async ({ page }) => {
    const token = showcaseToken()
    const documentId = outstandingRequestId()

    await page.goto(`/c/${token}/documents`)

    // 1. Fetch the sample generated for this specific request.
    const sample = await page.request.get(`/api/samples/${documentId}`)

    // 2. Post it back through the upload control.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: await sample.body(),
    })

    // 3. What was read shows straight back in the card that was uploaded to.
    await expect(page.getByText('Received', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('What we read').first()).toBeVisible()

    // 4. And the parse actually landed in the database, not just the DOM.
    const row = sql(
      `SELECT "extractionStatus"||'|'||COALESCE("extractionMethod",'-')||'|'||COALESCE(confidence,'-')
         FROM "Document" WHERE id='${documentId}';`,
    )
    expect(row).toBe('EXTRACTED|PDF_TEXT|high')

    const expiry = sql(
      `SELECT "extractedFields"->>'expiresOn' FROM "Document" WHERE id='${documentId}';`,
    )
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // 5. The showcase account is demo-able on repeat: a reload files the upload
    //    under "Already sent" and puts a fresh request back in its place.
    await page.reload()
    await expect(page.getByText('Already sent')).toBeVisible()
    await expect(page.locator('input[type="file"]').first()).toBeAttached()
    expect(outstandingRequestId()).not.toBe(documentId)
  })

  test('the uploaded document then appears on the staff scans screen', async ({ page }) => {
    await page.goto('/scans')

    await expect(page.getByText('Two reading paths, one pipeline')).toBeVisible()
    await expect(page.getByText('PDF text parser').first()).toBeVisible()
    await expect(page.getByText('Read from image vs. record').first()).toBeVisible()
  })
})
