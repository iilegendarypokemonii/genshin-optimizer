import { expect, test } from '@playwright/test'
// biome-ignore lint/style/noRestrictedImports: the e2e tests check the app's own tool list, which no library exports
import { toolsManifest } from '../../frontend/src/app/Tools/toolsManifest'

const enka = toolsManifest.find((tool) => tool.id === 'enka-network')!

test.describe('Tools page', () => {
  test('Tools page loads', async ({ page }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('tools-page')).toBeVisible()
  })

  test('All tool cards are displayed', async ({ page }) => {
    await page.goto('/#/tools')
    for (const tool of toolsManifest) {
      const card = page.getByTestId(`tool-card-${tool.id}`)
      await expect(card).toBeVisible()
      await expect(card).toContainText(tool.name)
      await expect(card).toContainText(tool.category)
    }
  })

  test('Opening a tool shows the viewer', async ({ page }) => {
    await page.goto('/#/tools')
    await page
      .getByRole('button', { name: 'Open Enka.Network in app', exact: true })
      .click()

    await expect(page.getByTestId('tool-viewer')).toBeVisible()
    await expect(page.getByTestId('tool-iframe')).toHaveAttribute(
      'src',
      enka.url
    )
  })

  test('Closing the viewer returns to grid', async ({ page }) => {
    await page.goto('/#/tools/enka-network')
    await expect(page.getByTestId('tool-viewer')).toBeVisible()

    await page
      .getByTestId('tool-viewer')
      .getByRole('button', { name: 'Close' })
      .click()

    await expect(page.getByTestId('tools-page')).toBeVisible()
    await expect(page.getByTestId(`tool-card-${enka.id}`)).toBeVisible()
  })

  test('Account links open the profile for the database UID', async ({
    page,
  }) => {
    await page.goto('/#/setting')
    await page.getByRole('textbox', { name: 'UID' }).first().fill('712345678')

    await page.goto('/#/tools')
    await page
      .getByRole('button', { name: 'Open Enka.Network for Database 1' })
      .click()
    await expect(page.getByTestId('tool-iframe')).toHaveAttribute(
      'src',
      'https://enka.network/u/712345678'
    )
  })

  test('Only https URLs are accepted as a viewer URL', async ({ page }) => {
    await page.goto(
      `/#/tools/enka-network?url=${encodeURIComponent('javascript:alert(1)')}`
    )
    await expect(page.getByTestId('tool-iframe')).toHaveAttribute(
      'src',
      enka.url
    )
  })

  test('Navigation from header', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.locator('#root')).not.toBeEmpty()

    const toolsTab = page.locator('a[href*="tools"]').first()
    await expect(toolsTab).toBeVisible()
    await toolsTab.click()

    await expect(page).toHaveURL(/.*#\/tools/)
    await expect(page.getByTestId('tools-page')).toBeVisible()
  })
})
