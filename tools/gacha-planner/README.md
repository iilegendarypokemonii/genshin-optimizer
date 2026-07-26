# Local gacha planner

This command answers account-aware Character Event planning questions without
driving the external calculator. It resolves app profile names from local
storage, reads the latest wish export, derives pity, ordinary guarantee, and
the theoretical Capturing Radiance state, then runs the same probability model
as Hu Tao's Gacha Rate Calculator. Its hypothesis-A Radiance score is a
community model; HoYoverse has not published the per-score odds or transitions.

Examples:

```powershell
yarn gacha:plan -- --account 3 --character Odette --target C2
yarn gacha:plan -- --account 3 --character Odette --target C0 --primos 5000 --future 10000
```

Use `--current C0` if the character is already owned, and add `--fates` or
`--future-fates` when relevant. Omit `--account` to use the currently selected
app profile. Add `--json` for machine-readable output.

The model assumes the target is the featured Character Event five-star, no
intervening pulls change the saved state, and Starglitter refunds are not
reinvested.
