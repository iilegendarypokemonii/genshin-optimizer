# Sandrone–Odette simulation handover

This note records the reusable lessons from calibrating WFPSim against independent calculations for Sandrone C0, Odette C0, Yae Miko C1, and Qiqi C1.

## Final benchmark

- One level-100 enemy with 10% resistance.
- Current Odette data; level 90 characters with triple-crowned talents.
- KQM-standard artifact substats, optimized by WFPSim.
- Weapons: Tidal Shadow R5, Finale of the Deep R5, Echoes of the Heart R5, and Favonius Sword R5.
- Sets used in the fixture: Disenchantment on Sandrone and Yae, Heart of the Furnace on Odette, and Tenacity on Qiqi.
- Rotation: `Yae EEE -> Odette EE -> Qiqi E -> Sandrone (CA -> E) x2 -> Q -> CA -> E`.
- Three rotations beginning every 20 seconds; every Sandrone CA is held for three beams.

The final 10,000-iteration executable result was **172.1k DPS**. Retaining the final rotation's lingering hits and using the manual 20-second convention produced approximately **3.492M DPR / 174.6k DPS**.

Result: <https://wfpsim.com/sh/01079cb8-d5d8-42cd-be41-9955a79ae8bb>

The share may expire. The detailed configs, samples, custom executable, and research remain under the local git-ignored `scratch/theorycrafting/` directory.

## Important lessons

1. **Rotation order materially changes the result.** Yae must act before Odette so Electro and Stellar Conduct are established before Odette's skill. Reversing them cost roughly 4–5k DPS in this fixture.
2. **Compare DPR before DPS.** Independent sheets commonly round a cooldown-based rotation to 20 seconds. Executable simulations may truncate lingering hits or use a slightly longer window, creating an apparent DPS disagreement despite similar total rotation damage.
3. **Do not mix historical and current Odette data.** The current engine includes the later Daybreak SSC buff. Stellar Swirl is not used by this team.
4. **The historical Odette discrepancy is probably convention/data drift.** An older sheet assigned much more damage to Odette while keeping similar team DPR. Its Odette result was close to applying the approximately 1.5x SSW multipliers to SSC attacks. WFPSim also had a historical SSC/SSW Daybreak-array swap. This is a diagnostic clue, not permission to change the current formula.
5. **Polestar remains a high-risk assumption.** The pinned engine uses a 12-stack cap, a 0.1-second application ICD, and four-second stack snapshots. Its implementation is early and not fully documented by public beta data. Record the model version and inspect tiers per hit; do not tune stacks merely to reproduce another calculator's total.
6. **New-content shares may be view-only.** Public WFPSim did not yet contain Echoes of the Heart (weapon ID 14436), so it was implemented locally. The shared result is inspectable but cannot be rerun publicly until upstream coverage catches up.
7. **Audit character distribution, not only team DPS.** Similar team totals can conceal large, cancelling errors between characters. Always retain damage by character, damage by ability, active buffs, reaction multipliers, energy failures, and the exact action list.

## Recommended workflow

Pin the WFPSim revision and data version, import or reconstruct builds, optimize the chosen artifact standard, run at least three rotations against one level-100/10%-RES target, and retain both the result JSON and a representative sample trace. Report executable DPS separately from manual full-DPR conventions and attach an explicit confidence note for unsupported mechanics.
