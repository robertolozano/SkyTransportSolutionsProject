import { expect, test } from '@playwright/test'
import { sql, showcaseToken } from './helpers'

test.describe('staff console', () => {
  test('dashboard shows figures that match the database', async ({ page }) => {
    await page.goto('/dashboard')

    const overdue = sql(`SELECT count(*) FROM "Obligation" WHERE status='OVERDUE';`)
    // The stat tiles are the headline numbers; if they drift from the database
    // the whole screen is lying, which matters more here than on most products.
    const overdueTile = page.getByRole('link', { name: /^Overdue/ })
    await expect(overdueTile).toBeVisible()
    await expect(overdueTile).toContainText(overdue)
  })

  test('view toggle is reachable without scrolling on a long page', async ({ page }) => {
    // /deadlines renders 200 rows — the exact case that used to bury the toggle.
    await page.goto('/deadlines')

    const toggle = page.getByRole('link', { name: 'Client', exact: true })
    await expect(toggle).toBeVisible()

    // Visible is not enough: assert it sits inside the viewport without scrolling.
    const box = await toggle.boundingBox()
    const viewport = page.viewportSize()!
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
  })

  test('content pane scrolls independently of the sidebar', async ({ page }) => {
    await page.goto('/deadlines')

    const main = page.locator('main')
    await main.evaluate((el) => el.scrollTo(0, 1200))
    const scrolled = await main.evaluate((el) => el.scrollTop)
    expect(scrolled).toBeGreaterThan(0)

    // The page itself must not have moved, so the sidebar stays put.
    const windowScroll = await page.evaluate(() => window.scrollY)
    expect(windowScroll).toBe(0)

    await expect(page.getByRole('link', { name: 'Client', exact: true })).toBeInViewport()
  })

  test('sorting a column actually reorders the rows', async ({ page }) => {
    await page.goto('/deadlines')

    const firstCarrier = () => page.locator('tbody tr').first().locator('td').first().innerText()

    await page.getByRole('link', { name: 'Carrier', exact: true }).click()
    await page.waitForURL(/sort=carrier/)
    const ascending = await firstCarrier()

    await page.getByRole('link', { name: 'Carrier', exact: true }).click()
    await page.waitForURL(/dir=desc/)
    const descending = await firstCarrier()

    expect(ascending).not.toBe(descending)
    // Ascending really is ascending.
    expect([ascending, descending].sort()[0]).toBe(ascending)
  })

  test('multiselect filter narrows the result count', async ({ page }) => {
    await page.goto('/deadlines')

    const before = sql(`SELECT count(*) FROM "Obligation" WHERE status <> 'COMPLETED';`)
    await expect(page.locator('body')).toContainText(before)

    await page.getByRole('button', { name: /^Status:/ }).click()
    await page.getByRole('option', { name: 'Overdue' }).click()
    await page.waitForURL(/status=OVERDUE/)

    const overdue = sql(`SELECT count(*) FROM "Obligation" WHERE status='OVERDUE';`)
    await expect(page.locator('body')).toContainText(`${overdue} obligations match`)
  })

  test('the dependency chain and out-of-service date render on the hero truck', async ({ page }) => {
    const vin = sql(
      `SELECT t.vin FROM "Truck" t JOIN "Carrier" c ON c.id=t."carrierId"
        WHERE c."dotNumber"='3421569' AND t."unitNumber"='101';`,
    )
    await page.goto(`/trucks/${vin}`)

    await expect(page.getByText('Out of service on')).toBeVisible()

    // Scope to the rendered chain: the same labels also exist inside the
    // what-if <select>, whose <option> elements are hidden.
    const chain = page.locator('div').filter({ hasText: /^What-if/ }).first()
    for (const label of ['CARB Clean Truck Check', 'Form 2290 (HVUT)', 'IRP Plate Renewal']) {
      await expect(chain.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('Action plan')).toBeVisible()
  })

  test('what-if simulator re-renders the chain when a date slips', async ({ page }) => {
    const vin = sql(
      `SELECT t.vin FROM "Truck" t JOIN "Carrier" c ON c.id=t."carrierId"
        WHERE c."dotNumber"='3421569' AND t."unitNumber"='101';`,
    )
    await page.goto(`/trucks/${vin}`)

    const slider = page.locator('input[type="range"]')
    await expect(slider).toBeVisible()

    // Push a prerequisite well past the deadline it protects.
    await slider.fill('120')
    await expect(page.getByText('Chain broken')).toBeVisible()

    await page.getByRole('button', { name: 'reset' }).click()
    await expect(page.getByText('Chain broken')).toHaveCount(0)
  })

  test('toggle navigates to the client portal', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Client', exact: true }).click()
    await page.waitForURL(`/c/${showcaseToken()}`)
    await expect(page.getByRole('heading', { name: /Altamont Freight Systems/ })).toBeVisible()
  })
})
