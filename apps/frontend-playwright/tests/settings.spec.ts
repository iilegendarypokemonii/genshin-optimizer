import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
  test('database card shows 6 account slots', async ({ page }) => {
    await page.goto('/#/setting')

    // One slot is the active database, the other five are labeled by index.
    await expect(page.getByText('Current Database', { exact: true })).toBeVisible()
    for (const n of [2, 3, 4, 5, 6]) {
      await expect(page.getByText(`Database ${n}`, { exact: true })).toBeVisible()
    }
  })
})
