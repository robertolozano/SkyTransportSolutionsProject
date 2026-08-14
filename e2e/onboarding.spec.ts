import { expect, test } from '@playwright/test'
import { sql } from './helpers'

/**
 * The acquisition journey: prospect → account → lead in the staff console.
 *
 * This is the one flow that runs with no authentication, because the person
 * filling it in has no account yet — the account is what the flow produces.
 */
test.describe('public onboarding', () => {
  test('requirement list responds live to the answers', async ({ page }) => {
    await page.goto('/start')

    const count = page.locator('.numeric', { hasText: /^\d+\s/ }).first()
    await expect(page.getByText("What you'll need")).toBeVisible()

    // Interstate for-hire is the heaviest configuration.
    const interstate = await count.innerText()

    // Answering "no" to crossing state lines must visibly drop federal items.
    await page
      .locator('li')
      .filter({ hasText: 'Will you cross state lines?' })
      .getByRole('button', { name: 'No' })
      .click()

    await expect(page.getByText('IRP apportioned plates')).toHaveCount(0)
    await expect(page.getByText('IFTA fuel tax licence')).toHaveCount(0)

    const intrastate = await count.innerText()
    expect(parseInt(intrastate)).toBeLessThan(parseInt(interstate))
  })

  test('price drops when the operation is intrastate only', async ({ page }) => {
    await page.goto('/start')
    await expect(page.getByText('$1200')).toBeVisible()

    await page
      .locator('li')
      .filter({ hasText: 'Will you cross state lines?' })
      .getByRole('button', { name: 'No' })
      .click()

    await expect(page.getByText('$975')).toBeVisible()
  })

  test('completing the walkthrough creates a prospect that reaches the staff console', async ({
    page,
  }) => {
    const stamp = Date.now()
    const company = `E2E Test Hauling ${stamp}`

    await page.goto('/start')
    await page.getByRole('button', { name: 'Get my setup plan' }).click()

    await page.getByLabel('Company name').fill(company)
    await page.getByLabel('Your name').fill('Dana Ruiz')
    await page.getByLabel('Email').fill(`dana+${stamp}@example.com`)
    await page.getByRole('button', { name: 'Create my account' }).click()

    // 1. Lands on the confirmation with the plan it just derived.
    await page.waitForURL(/\/start\/submitted\//)
    await expect(page.getByText("You're set up", { exact: false })).toBeVisible()
    await expect(page.getByText('What you need, in order')).toBeVisible()

    // 2. The record is real, and is a PROSPECT rather than a client.
    const row = sql(
      `SELECT status||'|'||COALESCE("contactName",'-')||'|'||COALESCE("recommendedPrice"::text,'-')
         FROM "Carrier" WHERE "legalName"='${company}';`,
    )
    expect(row).toBe('PROSPECT|Dana Ruiz|1200')

    // 3. No USDOT was given, so it is stored as pending rather than invented.
    const dot = sql(`SELECT "dotNumber" FROM "Carrier" WHERE "legalName"='${company}';`)
    expect(dot).toMatch(/^PENDING-/)

    // 4. Their portal shows the onboarding state, not "you're covered".
    const token = sql(`SELECT "portalToken" FROM "Carrier" WHERE "legalName"='${company}';`)
    await page.goto(`/c/${token}`)
    await expect(page.getByText("We're setting you up")).toBeVisible()
    await expect(page.getByText("You're covered")).toHaveCount(0)

    // 5. And staff see them as a new lead, at the top of the book.
    await page.goto('/clients')
    await expect(page.getByText('New lead').first()).toBeVisible()
    await expect(page.getByText(company)).toBeVisible()
    await expect(page.getByText('USDOT not yet issued').first()).toBeVisible()

    // Clean up so repeated runs don't accumulate rows.
    sql(`DELETE FROM "Carrier" WHERE "legalName"='${company}';`)
  })

  test('an existing USDOT number is refused rather than duplicated', async ({ page }) => {
    await page.goto('/start')
    await page.getByRole('button', { name: 'Get my setup plan' }).click()

    await page.getByLabel('Company name').fill('Duplicate Attempt LLC')
    await page.getByLabel('Your name').fill('Test User')
    await page.getByLabel('Email').fill('dupe@example.com')
    await page.getByLabel('USDOT number').fill('3421569') // the showcase carrier
    await page.getByRole('button', { name: 'Create my account' }).click()

    await expect(page.getByText(/already have an account for that USDOT number/)).toBeVisible()
    expect(sql(`SELECT count(*) FROM "Carrier" WHERE "legalName"='Duplicate Attempt LLC';`)).toBe(
      '0',
    )
  })

  test('staff can open a client view from the carrier record', async ({ page }) => {
    await page.goto('/clients/3421569')
    await page.getByRole('link', { name: /View as client/ }).click()
    await page.waitForURL(/\/c\//)
    await expect(page.getByRole('heading', { name: /Altamont Freight Systems/ })).toBeVisible()
  })
})
