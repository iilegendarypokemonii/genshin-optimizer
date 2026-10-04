export default async function irminsulError(ctx) {
  const wrapper = await ctx.fixture('irminsul/patch-7-1.json')
  const bad = structuredClone(wrapper.fixture)
  bad.items.find((item) => item.kind === 'weapon').id = 4294967295
  await ctx.step('unknown-weapon-error', async () => {
    await ctx.goto('/tools/game-data')
    await ctx
      .invoke('irminsul_inject_fixture', { fixture: JSON.stringify(bad) })
      .then(
        () => {
          throw new Error('unknown weapon was accepted')
        },
        (error) => {
          if (!/Unknown weapon ID/i.test(String(error)))
            throw new Error(`Unexpected rejection: ${error}`)
        }
      )
    await ctx.page
      .getByRole('alert')
      .filter({ hasText: /Unknown weapon ID/ })
      .waitFor()
  })
  await ctx.step('recovery', async () => {
    await ctx.invoke('irminsul_inject_fixture', {
      fixture: JSON.stringify(wrapper.fixture),
    })
    await ctx.page
      .getByRole('alert')
      .filter({ hasText: /Unknown weapon ID/ })
      .waitFor({ state: 'hidden' })
  })
}
