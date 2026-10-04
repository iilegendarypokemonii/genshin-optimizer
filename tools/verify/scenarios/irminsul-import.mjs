import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export function assertSnapshot(snapshot, expected) {
  assert.equal(snapshot.uid, expected.uid)
  assert.deepEqual(snapshot.counts, expected.counts)
  assert.deepEqual(
    snapshot.good.characters.map((item) => item.key).sort(),
    [...expected.characterKeys].sort()
  )
  for (const key of expected.absentCharacterKeys)
    assert(!snapshot.good.characters.some((item) => item.key === key))
  assert.deepEqual(
    snapshot.good.weapons.map((item) => item.key).sort(),
    [...expected.weaponKeys].sort()
  )
  assert.deepEqual(
    Object.keys(snapshot.good.materials).sort(),
    [...expected.materialKeys].sort()
  )
  for (const expectedArtifact of expected.artifactKeys) {
    assert(
      snapshot.good.artifacts.some((artifact) =>
        Object.entries(expectedArtifact).every(
          ([key, value]) => artifact[key] === value
        )
      ),
      'Expected artifact is missing'
    )
  }
  for (const equipped of expected.equippedLocations) {
    const index = snapshot.artifactGuids.indexOf(equipped.artifactGuid)
    assert(index >= 0)
    assert.equal(snapshot.good.artifacts[index].location, equipped.location)
  }
}

export default async function irminsulImport(ctx) {
  const wrapper = await ctx.fixture('irminsul/patch-7-1.json')
  const expected = wrapper.expect
  await ctx.step('database-uid', async () => {
    await ctx.goto('/setting')
    const uid = ctx.page.getByPlaceholder('UID').first()
    await uid.fill(expected.uid)
    await uid.press('Tab')
    await ctx.waitForStorage((storage) =>
      JSON.stringify(storage).includes(expected.uid)
    )
  })
  await ctx.step('native-export', async () => {
    await ctx.invoke('irminsul_inject_fixture', {
      fixture: JSON.stringify(wrapper.fixture),
    })
    const state = await ctx.invoke('irminsul_status')
    const summary = state.snapshots.find((item) => item.uid === expected.uid)
    assert(summary, 'Injected snapshot missing from native state')
    const snapshot = await ctx.invoke('irminsul_snapshot', {
      uid: expected.uid,
      captureId: summary.captureId,
    })
    await ctx.evidence.write(
      'scenarios/irminsul-import/snapshot.json',
      snapshot
    )
    assertSnapshot(snapshot, expected)
    return snapshot.counts
  })
  await ctx.step('preview', async () => {
    await ctx.goto('/tools/game-data')
    await ctx.page
      .getByRole('heading', { name: 'Game data', exact: true })
      .waitFor()
    for (const category of ['Artifacts', 'Characters', 'Weapons']) {
      const checkbox = ctx.page.getByRole('checkbox', {
        name: new RegExp(`^${category} \\(`),
      })
      if (!(await checkbox.isChecked())) await checkbox.click()
      await expect(checkbox).toBeChecked()
    }
    await ctx.page
      .getByRole('button', { name: 'Preview optimizer import', exact: true })
      .click()
    const dialog = ctx.page.getByRole('dialog')
    await dialog.getByText(`UID ${expected.uid}`, { exact: false }).waitFor()
    for (const category of ['characters', 'weapons', 'artifacts']) {
      await dialog
        .getByText(
          `${category}: ${expected.counts[category]} selected from capture;`,
          { exact: false }
        )
        .waitFor()
    }
  })
  await ctx.step('import', async () => {
    await ctx.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Import into this account', exact: true })
      .click()
    await ctx.page
      .getByRole('alert')
      .filter({ hasText: `Imported selected data into ${expected.uid}.` })
      .waitFor()
    await ctx.waitForStorage((storage) =>
      expected.characterKeys.every((key) =>
        JSON.stringify(storage).includes(key)
      )
    )
  })
  await ctx.step('characters', async () => {
    await ctx.goto('/characters')
    await ctx.page.getByText('Vodyanitsa', { exact: true }).first().waitFor()
    await ctx.page.getByText('Lumine', { exact: true }).first().waitFor()
  })
  await ctx.step('weapons', async () => {
    await ctx.goto('/weapons')
    await ctx.page
      .getByText(/Winter.s Heavy Heart/)
      .first()
      .waitFor()
  })
}
