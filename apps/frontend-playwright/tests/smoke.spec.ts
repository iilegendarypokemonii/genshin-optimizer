import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('body')).toBeVisible()
    // The app should render some meaningful content (not a blank page)
    await expect(page.locator('#root')).not.toBeEmpty()
  })

  const routes = [
    { name: 'Artifacts', path: '/#/artifacts' },
    { name: 'Weapons', path: '/#/weapons' },
    { name: 'Characters', path: '/#/characters' },
    { name: 'Teams', path: '/#/teams' },
    { name: 'Archive', path: '/#/archive' },
    { name: 'Setting', path: '/#/setting' },
    { name: 'Doc', path: '/#/doc' },
  ]

  for (const route of routes) {
    test(`${route.name} page loads without errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto(route.path)
      await expect(page.locator('#root')).not.toBeEmpty()

      expect(errors).toEqual([])
    })
  }
})

test.describe('Navigation', () => {
  test('can navigate between pages via header tabs', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('#root')).not.toBeEmpty()

    // Navigate to Artifacts via the nav
    const artifactsTab = page.locator('a[href*="artifacts"]').first()
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click()
      await expect(page).toHaveURL(/.*#\/artifacts/)
      await expect(page.locator('#root')).not.toBeEmpty()
    }

    // Navigate to Characters via the nav
    const charactersTab = page.locator('a[href*="characters"]').first()
    if (await charactersTab.isVisible()) {
      await charactersTab.click()
      await expect(page).toHaveURL(/.*#\/characters/)
      await expect(page.locator('#root')).not.toBeEmpty()
    }

    // Navigate to Weapons via the nav
    const weaponsTab = page.locator('a[href*="weapons"]').first()
    if (await weaponsTab.isVisible()) {
      await weaponsTab.click()
      await expect(page).toHaveURL(/.*#\/weapons/)
      await expect(page.locator('#root')).not.toBeEmpty()
    }
  })
})
