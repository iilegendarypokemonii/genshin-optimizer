export default async function goodUpload(ctx) {
  const fixture = await ctx.fixture('good/basic.json')
  await ctx.step('paste-good', async () => {
    await ctx.goto('/setting')
    await ctx.page.getByRole('button', { name: 'Upload' }).first().click()
    await ctx.page.locator('textarea').first().fill(JSON.stringify(fixture))
    await ctx.page.getByRole('button', { name: 'Update Database' }).click()
  })
  await ctx.step('good-on-disk', async () => {
    const storage = await ctx.waitForStorage((value) =>
      JSON.stringify(value).includes('Amber')
    )
    if (!JSON.stringify(storage).includes('Amber'))
      throw new Error('Amber was not persisted in storage/localStorage.json')
    await ctx.evidence.write(
      'scenarios/good-upload/storage-before-restart.json',
      storage
    )
    await ctx.goto('/characters')
    await ctx.page.getByText('Amber', { exact: true }).waitFor()
  })
  await ctx.step('good-survives-restart', async () => {
    await ctx.restart()
    await ctx.goto('/characters')
    await ctx.page.getByText('Amber', { exact: true }).waitFor()
  })
}
