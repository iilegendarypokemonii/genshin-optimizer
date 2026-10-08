// Multi-optimization targets: add a target in list mode, convert the
// multi-target to an expression, and check it is saved and survives a restart.
const TEAM_URL = '/teams/team_verify/Amber/optimize'
const NAME = 'New Custom Target 1'

function topModal(ctx) {
  return ctx.page.locator('.MuiModal-root').last()
}

async function assertTranslated(ctx) {
  const text = await topModal(ctx).innerText()
  const raw = text.match(/multiTarget\.[A-Za-z]+/g)
  if (raw)
    throw new Error(`Untranslated labels: ${[...new Set(raw)].join(', ')}`)
}

async function openConfig(ctx) {
  await ctx.goto(TEAM_URL)
  await ctx.page
    .getByRole('button', { name: /^Multi-Optimization Target Config/ })
    .click()
  await topModal(ctx).getByText('Create Multi-Opt').waitFor()
}

export default async function multiTargetEditor(ctx) {
  await ctx.step('load-team', async () => {
    const fixture = await ctx.fixture('good/team-multi-target.json')
    await ctx.goto('/setting')
    await ctx.page.getByRole('button', { name: 'Upload' }).first().click()
    await ctx.page.locator('textarea').first().fill(JSON.stringify(fixture))
    await ctx.page.getByRole('button', { name: 'Update Database' }).click()
    await ctx.waitForStorage((value) =>
      JSON.stringify(value).includes('teamchar_verify')
    )
  })
  await ctx.step('list-target', async () => {
    await openConfig(ctx)
    await ctx.page.getByRole('button', { name: 'Create Multi-Opt' }).click()
    await ctx.page.getByText(NAME, { exact: true }).click()
    await ctx.page.getByRole('button', { name: 'Add Target' }).click()
    await topModal(ctx).getByText('Target Selector').waitFor()
    await topModal(ctx)
      .getByText('Fully-Charged Aimed Shot', { exact: true })
      .first()
      .click()
    // the new target is selected for editing straight away
    await topModal(ctx).getByText('Target Editor').waitFor()
    await topModal(ctx).getByText('#1', { exact: true }).waitFor()
    await assertTranslated(ctx)
  })
  await ctx.step('convert-to-expression', async () => {
    await ctx.page
      .getByRole('button', { name: 'Convert to Expression' })
      .click()
    await topModal(ctx).getByRole('button', { name: 'New ƒ' }).waitFor()
    await topModal(ctx).getByRole('button', { name: 'New Arg' }).waitFor()
    await assertTranslated(ctx)
  })
  await ctx.step('expression-saved', async () => {
    // the config dialog saves when it closes
    await ctx.page.keyboard.press('Escape')
    await topModal(ctx).getByText('Expression', { exact: true }).waitFor()
    await ctx.page.keyboard.press('Escape')
    const storage = await ctx.waitForStorage((value) => {
      const text = JSON.stringify(value)
      return text.includes('aimedCharged') && text.includes('multiplication')
    })
    await ctx.evidence.write(
      'scenarios/multi-target-editor/storage.json',
      storage
    )
  })
  await ctx.step('expression-survives-restart', async () => {
    await ctx.restart()
    await openConfig(ctx)
    await topModal(ctx).getByText(NAME, { exact: true }).waitFor()
    await topModal(ctx).getByText('Expression', { exact: true }).waitFor()
  })
}
