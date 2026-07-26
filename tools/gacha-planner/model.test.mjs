import assert from 'node:assert/strict'
import test from 'node:test'
import { copiesNeeded, planQuestion, simulatePlan } from './model.mjs'

const acc3 = {
  currentPity: 1,
  guaranteed: false,
  radianceScore: 3,
}

test('matches Hu Tao calculator for acc3 C0 at 75 pulls', () => {
  const plan = simulatePlan(acc3, 1)
  assert.ok(Math.abs(plan.cumulative[75] - 0.56917352) < 1e-8)
  assert.equal(plan.worstCasePulls, 89)
})

test('matches Hu Tao calculator for acc3 C2 at 244 pulls', () => {
  const plan = simulatePlan(acc3, 3)
  assert.ok(Math.abs(plan.cumulative[244] - 0.50498609) < 1e-8)
  assert.equal(plan.worstCasePulls, 449)
})

test('combines Primogems and fates into a budget', () => {
  const plan = planQuestion({
    account: acc3,
    targetCopies: 1,
    primogems: 5000,
    futurePrimogems: 10000,
    fates: 2,
  })
  assert.equal(plan.availablePulls, 95)
  assert.equal(plan.leftoverPrimogems, 120)
  assert.ok(plan.chance >= 1 - 1e-12)
})

test('calculates copies from current and target constellations', () => {
  assert.equal(copiesNeeded('unowned', 'C2'), 3)
  assert.equal(copiesNeeded('C0', 'C2'), 2)
})
