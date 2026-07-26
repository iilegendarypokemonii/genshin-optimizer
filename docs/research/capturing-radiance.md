# Capturing Radiance: tracker-evidence review

Research refreshed: 2026-07-26. Scope: Character Event Wish / Character Event
Wish-2. This is an evidence review, not a claim that client-visible Wish
History exposes a hidden Radiance result.

## Conclusion for tracker logic

**Do not keep or present the score-transition model as an accurate rule.** The
model `start 1; loss +1; ordinary 50/50 featured win -1; guarantee neutral;
score 2 has a chance; score 3 is guaranteed` is **not supported** by an
official source or by a reproducible, later large-sample/reverse-engineering
source found in this review. Its final outcome resembles the public three-loss
protection, but its start value, decrement/reset behaviour and score-2
probability are unverified.

The safe product rule is narrower: track the normal featured guarantee; permit
a player to annotate a confirmed Radiance animation; and otherwise say that
the current Radiance state and chance of the next 50/50 cannot be derived from
exported history. Do not calculate/display `capturingRadianceScore` as fact or
use it for a pull recommendation. Confidence: **high**.

## Official facts (high confidence)

[HoYoverse, *"Capturing Radiance" Mechanic: You Ask, I Answer!*](https://genshin.hoyoverse.com/en/news/detail/125274),
published **2024-08-16** (its current page also carries a **2025-02-10**
clarification), is the controlling source. It says:

- The mechanic was added **after the Version 5.0 update**. The official
  [Version 5.0 Update Details](https://www.hoyolab.com/article/32547672),
  published **2024-08-27 23:00:12 UTC**, dates rollout to 2024-08-28.
  Pre-5.0 results therefore cannot be inputs to a Capturing-Radiance counter.
- It applies only to **Character Event Wish** and **Character Event Wish-2**;
  not Standard, Weapon, or other wish types.
- It can trigger only where the promotional 5-star is **not already
  guaranteed**. A trigger makes that 5-star promotional. The next 5-star after
  a normal off-banner 5-star remains the ordinary promotional guarantee and
  **does not trigger** Capturing Radiance.
- The consolidated chance that a 5-star on an eligible event wish is
  promotional is **55%**. The page's later clarification also states a
  **0.018% base trigger probability**. HoYoverse does not define that as a
  per-50/50 score probability, so it must not be converted to a `10%` or
  `50%` transition probability.
- HoYoverse guarantees Radiance on the next eligible 5-star after the
  promotional character was the **second 5-star on three consecutive
  occasions**. In normal play this is three cycles of off-banner loss then
  ordinary guarantee. This supports the endpoint protection, not hidden score
  arithmetic between those events.

The official wording says Radiance "doesn't affect the guarantees," but it
does **not** publish a Radiance counter, its carry-over/reset/decrement rules,
or a probability table by state. Guaranteed featured pulls are known to be
ineligible for a Radiance trigger; their effect on a separate hidden state is
**not published**. The official source establishes the Version 5.0 cutoff, but
does not separately say that a Radiance state carries across later banners.
Existing Character Event / Event-2 pity and guarantee carry-over still applies.

## Claimed score model vs evidence

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Starts at 1 in 5.0 | Unsupported | Official source names Version 5.0 but no initial counter. |
| Eligible off-banner standard character adds 1 | Unsupported as a counter transition | Compatible with the public endpoint, but not stated. |
| Ordinary featured 50/50 win subtracts 1 (floor 0) | Unsupported | No official or reproducible empirical source found. |
| Guaranteed featured pull is neutral | Partly supported operationally | It cannot trigger Radiance; hidden-score effect is undisclosed. |
| Score 2 has a chance / exact probability | Unsupported | No credible exact probability table found. |
| Score 3 guarantees Radiance | Overstates official rule | Public guarantee is after stated loss/guarantee cycles, not a published score. |
| Radiance decreases/resets score | Unsupported | No disclosed state exists to reset. |

## Community and multilingual check

The maintained English [Genshin Impact Wiki's Character Event Wish page](https://genshin-impact.fandom.com/wiki/Character_Event_Wish)
was last revised **2026-05-26** (revision 2101690). Its Capturing Radiance
section cites HoYoverse and repeats the official scope, 55%, 0.018%, and
three-consecutive-occurrences rule; it publishes no score table or transition
model.

On **2026-07-26**, I searched Chinese, Japanese, and Spanish community/wiki
surfaces using the original terms below, plus "data/statistics" and
"reverse-engineering" variants. They produced official explainers and
repetition of the 55%/three-loss wording, but **no dated, inspectable
large-sample dataset, methodology, or reverse-engineered client source** that
establishes the score model. Repetition across translations is not independent
evidence. There is therefore no credible multilingual convergence on the
claimed score transitions or score-2 probability.

| Language | Original term(s) searched | Result |
| --- | --- | --- |
| Chinese | Capturing Radiance: `&#25429;&#33719;&#26126;&#20809;`; mechanics/probability/data/statistics/reverse engineering: `&#26426;&#21046;`, `&#27010;&#29575;`, `&#25968;&#25454;&#32479;&#35745;`, `&#21453;&#32534;&#35793;` | No inspectable empirical/reverse-engineering validation located. |
| Japanese | Capturing Radiance: `&#25429;&#29554;&#26126;&#20809;`; probability/mechanism/data: `&#30906;&#29575;`, `&#20181;&#32068;&#12415;`, `&#12487;&#12540;&#12479;` | No inspectable empirical/reverse-engineering validation located. |
| Spanish | `Capturando el resplandor`; `probabilidad`, `puntos`, `analisis datos` | No inspectable empirical/reverse-engineering validation located. |

For contrast, the widely circulated early English theory
["How Capturing Radiance actually works (it's probably not 10%)"](https://www.reddit.com/r/Genshin_Impact/comments/1eu3hbs/how_capturing_radiance_actually_works_its/)
(**2024-08-18**) explicitly labels itself a hypothesis from very early
observations and proposes a different seven-loss ramp. A later
["Capturing Radiance - Details, Observations and Theories"](https://www.reddit.com/r/Genshin_Impact/comments/1f3ykny/capturing_radiance_details_observations_and/)
(**2024-08-29**) likewise labels its material observations/theories. These show
early public explanations conflicted; they validate neither model and are not
tracker inputs.

The maintained [Hu Tao Gacha Rate Calculator](https://hutaobot.moe/tools/gachacalc)
was also inspected directly on 2026-07-26. Its current "hypothese A" code uses
per-state featured rates `[50%, 50%, 55%, 100%]`: a loss increments the state,
an ordinary featured win decrements it with a floor of zero, a normal
post-loss guarantee leaves it unchanged, and Capturing Radiance resets it to
one. The calculator itself explicitly says the exact mechanic is unknown and
that its score-2 `55/45` rate is assumed. This is the theoretical model used by
the tracker at the user's request, not an official probability table.

## Later changes

The official 2025-02-10 clarification is the only rule-text revision located
in the controlling explainer. An inspection of accessible official Version
5.x update-detail notices located no later Capturing Radiance rule change as
of this research date. This is a bounded search result, not proof that an
unannounced/in-client text change cannot occur. Confidence: **moderate-high**.

## Wish History limitation

A Wish History row records the obtained item, rarity, time, banner type, id,
uid, and item type; it does not record the Radiance animation/result. A
featured 5-star in an eligible position is indistinguishable from an ordinary
50/50 win. See [the local Wish type](../../apps/frontend/src/app/WishTracker/types.ts).
Store a manually confirmed animation as `player-confirmed`; do not infer it
from the result row.
