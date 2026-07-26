const RADIANCE_START = '2024-08-28 00:00:00'
const RADIANCE_FEATURED_RATES = [0.5, 0.5, 0.55, 1]
const STANDARD_FIVE_STAR_CHARACTERS = new Set([
  'Jean',
  'Diluc',
  'Mona',
  'Qiqi',
  'Keqing',
  'Tighnari',
  'Dehya',
  'Yumemizuki Mizuki',
])

function sortWishes(wishes) {
  return [...wishes].sort((a, b) =>
    a.time === b.time ? a.id.localeCompare(b.id) : a.time.localeCompare(b.time)
  )
}

function isCharacterEvent(wish) {
  return wish.gacha_type === '301' || wish.gacha_type === '400'
}

export function extractAccountState(file) {
  const eventWishes = sortWishes(file.wishes.filter(isCharacterEvent))
  const fiveStars = eventWishes.filter(
    (wish) => wish.rank_type === '5' && wish.item_type === 'Character'
  )

  let currentPity = 0
  for (const wish of eventWishes) {
    if (wish.rank_type === '5') currentPity = 0
    else currentPity += 1
  }

  let guaranteed = false
  for (const wish of fiveStars)
    guaranteed = STANDARD_FIVE_STAR_CHARACTERS.has(wish.name)

  let radianceScore = 1
  let guaranteeDuringScoreHistory = false
  for (const wish of fiveStars.filter((wish) => wish.time >= RADIANCE_START)) {
    if (STANDARD_FIVE_STAR_CHARACTERS.has(wish.name)) {
      radianceScore = Math.min(3, radianceScore + 1)
      guaranteeDuringScoreHistory = true
    } else if (wish.capturingRadiance) {
      radianceScore = 1
      guaranteeDuringScoreHistory = false
    } else if (guaranteeDuringScoreHistory) {
      guaranteeDuringScoreHistory = false
    } else {
      radianceScore = Math.max(0, radianceScore - 1)
    }
  }

  return {
    uid: file.uid,
    exported: file.exported,
    totalCharacterEventWishes: eventWishes.length,
    currentPity,
    guaranteed,
    radianceScore,
    nextNonGuaranteedFeaturedRate:
      RADIANCE_FEATURED_RATES[radianceScore] ?? 0.5,
    lastFiveStar: fiveStars.at(-1)?.name ?? null,
  }
}

function fiveStarRate(nextPity) {
  if (nextPity < 74) return 0.006
  return Math.min(1, (0.6 + 6 * (nextPity - 74 + 1)) / 100)
}

function stateKey(state) {
  return `${state.pity}|${Number(state.guaranteed)}|${state.radianceScore}|${state.copies}`
}

function addState(map, state, probability) {
  if (probability <= 0) return
  const key = stateKey(state)
  const existing = map.get(key)
  if (existing) existing.probability += probability
  else map.set(key, { ...state, probability })
}

function maximumFiveStarsNeeded(targetCopies, guaranteed, radianceScore) {
  const memo = new Map()

  const visit = (copiesRemaining, hasGuarantee, score) => {
    if (copiesRemaining <= 0) return 0

    const key = `${copiesRemaining}|${Number(hasGuarantee)}|${score}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    let result
    if (hasGuarantee) {
      result = 1 + visit(copiesRemaining - 1, false, score)
    } else {
      const featuredRate = RADIANCE_FEATURED_RATES[score] ?? 0.5
      const branches = []

      if (score < 3)
        branches.push(
          1 + visit(copiesRemaining - 1, false, Math.max(0, score - 1))
        )
      if (featuredRate > 0.5)
        branches.push(1 + visit(copiesRemaining - 1, false, 1))
      if (featuredRate < 1)
        branches.push(1 + visit(copiesRemaining, true, Math.min(3, score + 1)))

      result = Math.max(...branches)
    }

    memo.set(key, result)
    return result
  }

  return visit(targetCopies, guaranteed, radianceScore)
}

function worstCasePulls(account, targetCopies) {
  const fiveStars = maximumFiveStarsNeeded(
    targetCopies,
    account.guaranteed,
    account.radianceScore
  )
  if (fiveStars === 0) return 0
  return 90 - account.currentPity + (fiveStars - 1) * 90
}

export function simulatePlan(account, targetCopies, maxPulls) {
  const worstCase = worstCasePulls(account, targetCopies)
  const limit = maxPulls ?? worstCase
  const initialState = {
    pity: account.currentPity,
    guaranteed: account.guaranteed,
    radianceScore: account.radianceScore,
    copies: 0,
    probability: 1,
  }
  let states = new Map([[stateKey(initialState), initialState]])
  let completed = 0
  const cumulative = [0]

  for (let pull = 1; pull <= limit; pull += 1) {
    const next = new Map()
    let nextCompleted = completed

    for (const state of states.values()) {
      const nextPity = state.pity + 1
      const fiveStar = fiveStarRate(nextPity)

      addState(
        next,
        { ...state, pity: nextPity },
        state.probability * (1 - fiveStar)
      )

      const addFeatured = (probability, radianceScore) => {
        const copies = state.copies + 1
        const branchProbability = state.probability * fiveStar * probability
        if (copies >= targetCopies) nextCompleted += branchProbability
        else
          addState(
            next,
            { pity: 0, guaranteed: false, radianceScore, copies },
            branchProbability
          )
      }

      if (state.guaranteed) {
        addFeatured(1, state.radianceScore)
        continue
      }

      const featuredRate = RADIANCE_FEATURED_RATES[state.radianceScore] ?? 0.5
      const ordinaryWin = featuredRate === 1 ? 0 : 0.5
      const radianceWin = featuredRate - ordinaryWin
      const loss = 1 - featuredRate

      addFeatured(ordinaryWin, Math.max(0, state.radianceScore - 1))
      addFeatured(radianceWin, 1)
      addState(
        next,
        {
          pity: 0,
          guaranteed: true,
          radianceScore: Math.min(3, state.radianceScore + 1),
          copies: state.copies,
        },
        state.probability * fiveStar * loss
      )
    }

    states = next
    completed = Math.min(1, nextCompleted)
    cumulative.push(completed)
  }

  const quantilePulls = (target) =>
    cumulative.findIndex((probability) => probability >= target - 1e-12)

  let expectedPulls = 0
  for (let pulls = 0; pulls < cumulative.length - 1; pulls += 1)
    expectedPulls += 1 - cumulative[pulls]

  return {
    cumulative,
    expectedPulls,
    worstCasePulls: worstCase,
    milestones: Object.fromEntries(
      [0.5, 0.75, 0.9, 0.95, 0.99].map((target) => [
        target,
        quantilePulls(target),
      ])
    ),
  }
}

export function planQuestion({
  account,
  targetCopies,
  primogems = 0,
  futurePrimogems = 0,
  fates = 0,
  futureFates = 0,
}) {
  const simulation = simulatePlan(account, targetCopies)
  const totalPrimogems = primogems + futurePrimogems
  const totalFates = fates + futureFates
  const availablePulls = Math.floor(totalPrimogems / 160) + totalFates
  const chance =
    simulation.cumulative[
      Math.min(availablePulls, simulation.cumulative.length - 1)
    ] ?? 0

  return {
    ...simulation,
    totalPrimogems,
    totalFates,
    availablePulls,
    leftoverPrimogems: totalPrimogems % 160,
    chance,
    expectedPrimogems: Math.ceil(simulation.expectedPulls * 160),
    worstCasePrimogems: simulation.worstCasePulls * 160,
  }
}

export function constellationIndex(value) {
  const normalized = String(value ?? 'unowned')
    .trim()
    .toUpperCase()
  if (['UNOWNED', 'NONE', '-1'].includes(normalized)) return -1
  const match = normalized.match(/^C([0-6])$/)
  if (!match) throw new Error(`Invalid constellation: ${value}`)
  return Number(match[1])
}

export function copiesNeeded(current, target) {
  const currentIndex = constellationIndex(current)
  const targetIndex = constellationIndex(target)
  if (targetIndex <= currentIndex)
    throw new Error(`Target ${target} must be above current ${current}`)
  return targetIndex - currentIndex
}
