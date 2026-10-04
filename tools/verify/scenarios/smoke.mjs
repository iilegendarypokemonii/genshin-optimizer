const markers = {
  '/': { role: 'heading', name: 'Genshin Optimizer', exact: true },
  '/artifacts': {
    role: 'button',
    name: 'Add New Artifact',
    guide: 'Artifact Editing/Management Guide',
  },
  '/weapons': { role: 'button', name: 'Add New Weapon' },
  '/characters': { role: 'button', name: /add character/i },
  '/teams': { role: 'button', name: /add.*team/i },
  '/archive': { role: 'tab', name: /artifacts/i },
  '/setting': { text: 'Database' },
  '/tools': { role: 'heading', name: /tools/i },
  '/doc': { role: 'heading', name: 'Documentation' },
}

export default async function smoke(ctx) {
  for (const [route, locator] of Object.entries(markers)) {
    await ctx.step(
      `route-${route === '/' ? 'home' : route.slice(1)}`,
      async () => {
        await ctx.goto(route)
        if (locator.guide) {
          const guide = ctx.page.getByText(locator.guide, { exact: true })
          await guide.waitFor()
          await ctx.page.keyboard.press('Escape')
          await guide.waitFor({ state: 'hidden' })
        }
        const marker = locator.text
          ? ctx.page.getByText(locator.text, { exact: true })
          : ctx.page.getByRole(locator.role, { name: locator.name })
        await marker.first().waitFor()
      }
    )
  }
  await ctx.step('game-data', async () => {
    await ctx.goto('/tools/game-data')
    await ctx.page.getByRole('heading', { name: 'Game data' }).waitFor()
    await ctx.page
      .getByRole('heading', { name: 'Capture account data' })
      .waitFor()
  })
  await ctx.step('desktop-update-control', async () => {
    await ctx.page.getByRole('button', { name: 'Check for updates' }).waitFor()
  })
  await ctx.step('minimum-viewport', async () => {
    await ctx.page.setViewportSize({ width: 1120, height: 760 })
    const geometry = await ctx.page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }))
    if (geometry.width > geometry.viewport + 1)
      throw new Error(`horizontal overflow ${JSON.stringify(geometry)}`)
  })
}
