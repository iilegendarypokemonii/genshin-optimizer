import { test, expect } from '@playwright/test'

test.use({ launchOptions: { slowMo: 300 } })

const TOOL_IDS = [
  'enka-network',
  'paimon-moe',
  'genshin-interactive-map',
  'akasha-system',
  'project-ambr',
  'keqing-mains',
] as const

test.describe('Tools page', () => {
  test('Tools page loads', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()
  })

  test('All tool cards are displayed', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()

    for (const id of TOOL_IDS) {
      await expect(page.getByTestId(`tool-card-${id}`)).toBeVisible()
    }
  })

  test('Tool cards show name and description', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()

    // Verify enka-network card has visible text content
    const enkaCard = page.getByTestId('tool-card-enka-network')
    await expect(enkaCard).toBeVisible()
    await expect(enkaCard).toContainText('Enka')

    // Verify paimon-moe card has visible text content
    const paimonCard = page.getByTestId('tool-card-paimon-moe')
    await expect(paimonCard).toBeVisible()
    await expect(paimonCard).toContainText('Paimon')
  })

  test('Category chips are visible', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()

    // At least one category chip should be visible
    const categories = ['database', 'planner', 'wiki', 'community']
    const chipLocators = categories.map((cat) =>
      page.getByText(new RegExp(cat, 'i'))
    )

    // At least one of these category labels should be present on the page
    let found = false
    for (const locator of chipLocators) {
      if ((await locator.count()) > 0) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })

  test('Opening a tool shows the viewer', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()

    const enkaCard = page.getByTestId('tool-card-enka-network')
    await enkaCard.getByRole('button', { name: 'Open' }).click()

    const viewer = page.getByTestId('tool-viewer')
    await expect(viewer).toBeVisible()

    const iframe = page.getByTestId('tool-iframe')
    await expect(iframe).toBeVisible()
    await expect(iframe).toHaveAttribute('src', /enka\.network/)
  })

  test('Closing the viewer returns to grid', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()

    // Open a tool
    const enkaCard = page.getByTestId('tool-card-enka-network')
    await enkaCard.getByRole('button', { name: 'Open' }).click()
    await expect(page.getByTestId('tool-viewer')).toBeVisible()

    // Close the viewer
    const closeButton = page.getByTestId('tool-viewer').getByRole('button', { name: /close/i })
    await closeButton.click()

    // Verify tool cards are visible again
    await expect(page.getByTestId('tool-viewer')).not.toBeVisible()
    for (const id of TOOL_IDS) {
      await expect(page.getByTestId(`tool-card-${id}`)).toBeVisible()
    }
  })

  test('Navigation from header', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('#root')).not.toBeEmpty()

    // Click the Tools tab/link in the header
    const toolsTab = page.locator('a[href*="tools"]').first()
    await expect(toolsTab).toBeVisible()
    await toolsTab.click()

    await expect(page).toHaveURL(/.*#\/tools/)
    await expect(page.getByTestId('tools-page')).toBeVisible()
  })
})
