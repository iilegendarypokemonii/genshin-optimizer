# Genshin Optimizer Local — personal Windows modification

This is **Timon's personal modification** of [Gacha Optimizer / Genshin Optimizer](https://github.com/frzyc/genshin-optimizer), shared with friends. It is an unofficial desktop fork; the original optimizer and its authors are credited below.

**[Download the Windows app](https://github.com/iilegendarypokemonii/genshin-optimizer/releases/latest)** · [Installation](#install-on-windows) · [Updates](#update-the-app)

## What is different here?

- **Windows desktop app:** open the optimizer from your Start menu, with your data saved locally on your PC.
- **Wish Tracker:** import wish history from your local Genshin game cache, view pity/history per UID, keep backups, and record player-confirmed Capturing Radiance results.
- **Team DPS:** import damage screenshots, read them with Windows OCR, and keep team results and screenshots per optimizer account.
- **Tools page:** access the built-in tools and links to community resources, including account-specific Enka.Network and Akasha links.
- **Desktop updates:** check for this fork's published releases and install updates inside the app.

Each friend uses their own data. There is no separate optimizer signup or shared online account, and installing this app does not automatically import your Genshin account. Upstream game-data updates are included when a new desktop release is published here.

## Install on Windows

For **Windows 10/11 on an Intel or AMD 64-bit PC**.

1. Open **[the latest release](https://github.com/iilegendarypokemonii/genshin-optimizer/releases/latest)**.
2. Under **Assets**, download **`Genshin-Optimizer-Local-Setup.exe`**. You only need that file; the source-code, `.sig`, and `latest.json` downloads are for developers or the updater.
3. Double-click the installer and follow its steps. It installs for your Windows user and can install Microsoft's WebView2 runtime if needed, which requires internet access.
4. Open **Genshin Optimizer Local** from the Start menu or the desktop shortcut offered by the installer.

You do **not** need Git, Node.js, Rust, or any commands from the original developer guide below.

If no release is shown yet, the first installer has not been published. A draft release is only visible to the maintainer.

### First use

- Set up your own optimizer database in **Settings**, then import your existing optimizer/GOOD export or add your characters, weapons, and artifacts.
- For **Tools → Wish Tracker**, launch Genshin and open its Wish History first. If the app cannot find the game, enter your Genshin game folder path in the Wish Tracker settings. Each wish profile is identified by its own UID.
- For **Tools → Team DPS**, import a damage screenshot. OCR needs a supported Windows OCR language installed; the app gives instructions if none is available.

Your saved data lives under `%LOCALAPPDATA%\com.iilegendarypokemonii.genshinoptimizerlocal`, separately from the installed program. Data is not automatically synced between PCs. Use the optimizer's export and the Wish Tracker's backup controls to keep your own copies.

### Windows download notice

This personal app does not currently have a paid Windows publisher certificate, so Windows may show an unknown-publisher or SmartScreen notice. Only use downloads from this repository's release page. Update signatures verify updates inside the app; they are separate from Windows publisher signing.

## Update the app

Click **Check for updates** at the bottom of the app, then **Update and restart** when a release is available. Your local accounts, builds, wish history, and screenshots are kept. Finish any imports or scans before starting the update.

If checking fails, you can keep using your installed version and try again later. You can also close the app and run the latest installer over the existing installation. A GitHub commit alone is not an app update; updates become available when Timon publishes a new desktop release.

For problems with this modification, [open an issue in this fork](https://github.com/iilegendarypokemonii/genshin-optimizer/issues). For building the app or publishing releases, see the [desktop maintainer guide](docs/desktop.md).

---

The original Gacha Optimizer README follows, preserved below. Its website links and developer setup instructions describe the upstream project.

# Gacha Optimizer

<a href="https://frzyc.github.io/genshin-optimizer"><img alt="Website-link" src="https://img.shields.io/website?url=https%3A%2F%2Ffrzyc.github.io%2Fgenshin-optimizer&style=for-the-badge&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABDRJREFUWEftV21QVFUYfu62TBAL1lQTuSaK7IqQyWgGsn3I1J%2Fyh81ItdGmFGyzQLQRLMSypLSBLJaEhTkoIgRsfG6IGFM4NIogAiJtlgoN5ORQ1hSwBBEjtzkX98C9bEvTjOs0%2Bf7Z%2B9z33Pc873vOvh8MAJFUFqYHw8QBuBeukSGw7N7LfW3ZjFQWZgDDGF2zr2AXls1gFssVQwzgM1clEomwNjgIQQEyeHtLMD4%2BgYv9AzjV2YupqSmnXD083BG6Phj%2Bfkvh7n4rhkdssJ67gF7rebAsK%2Fx2iJHKFby3YSFrYTLqsNz3vnkbXfn5V2TuzEd94zGHJKK3PoOkhGiOtFD6%2BgeRkmFC5xkrT8UjQJibi%2FPg5ub2t14SLxLfzELNp028NcmvxeD1%2BCin0Zmc%2FBPKKC2PBCUgEjFoOVqOFcuXLngdRm1jCA2PAPklslLmhy8OHwI5uoXku4FLCH9KhenpaW4pJfDQg2tQV17A%2B%2F7jT%2Brx%2BbETWCL1QWriK7h9kTfVJ%2Bl3orK2kcPb0xKgjnqO6my2MZjyCjF46TIe3xiGl1RbeHaf3ZqAto4ePgFN9PMwpMTThV09VjytjKVYpdyMnEwdxeWV9Uh9axeHj1QXIviBQKrbnpWPotJqiitL8qEIXUcxIffBvlI%2BAaEXxAAxZJfVQSvxWV0Rxc0tJxGlSeVw13ELfO65m%2BoIceKAXfTJsYhTv0BxaYUF%2Bsz3%2BASMGYm8UO0rMuOd3NkjCZD7oblhhjWRL090QBWTxD2fbWvAXXfeQXWbItTotX5LsU6rhjZuG8UV1Q1IMZj%2BYwQWeXvhiXAF9eKnK7%2Bgtb3LdRGgOzt4cMkR3DACshW%2BIFlOKOfO92PPRyXX%2FwgcJSiX%2FgtuEhCLxfCSeELuvwy1c2rF%2Fy8R3UzF1z0CwnJ8oKQKO7L30Pxzf6AcTZaD%2F6gcb1Zq0N3zNV2blqxBvFo1W47NFuh3CMpxbEwk0nVkNJiRU6fPIuLFVylWbtmEd7PTZktq1WGkZORyuLFmP9asXkV1BmMeDpXVzq49mIdHFesp3vX%2BfuRfy6K0JSMNaU3Zh7yMW1hcieaWVkgX%2B3Dk5tZ8XXoOzDVHuPWZ6VqQjtguwyOjyMrde60l2wBNdCTPLmlMW9u7uXdzmlIRjjdVYJnvEmd1h9ONjf2OkPAIjIzaOBwY4I8mSzFIY7uQDH7%2FAx57MhJXrwqaUvLhwxvWoezAbojFtzi1ozPkwFw9471dhG2XIwNkqIl8%2BQ20n55pSHkRsL%2FY%2BEgITG%2FruLAL5bfhERhNBaiqOzpPxzAMyD3Sxm6Dp%2Bdt8%2FTEc3Jn2jrO8HQORzMSAXInglbJ4e0lwfjEBC70DeBkexcm%2Fph0Gh2JxJOLJJkvPOyj2TcX0dn9FZ0F7AZY4McbP5zax3OWYeKFQ%2BpCF%2Brf6jnPWbaAjOd%2FASJtuXEC9sEpAAAAAElFTkSuQmCC&label=Genshin%20Optimizer"></a>
<a href="https://frzyc.github.io/zenless-optimizer"><img alt="Website-link" src="https://img.shields.io/website?url=https%3A%2F%2Ffrzyc.github.io%2Fzenless-optimizer&style=for-the-badge&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABFZJREFUWEfFl39QVFUUx79vFx35JU7kouyMpbarqKBILAIZzqhMgkM7Ca7l5C8gBWaQMhVklZRkNCUdfpRCA8oPK4XYFAQ0IAaIJNAgGHPKHAFZfik%2FcteBTV5zl%2BGyLxbaaXa3%2B99959zz%2Fdzz3rv3HAYATyjyOgSGCQcwF%2BYZSrDsZ49%2B%2ByGBEYq85GCYePPo%2FkOFZQ8zjmJvJQPMISaBwB48hmcQi0ajweMn%2FRN8BbPtscp9BYSOc8DjMejq6kVdQxNa2zv0xVUyQrE3O2ZprC2E%2FQuzDAK4%2FXMLAmS7qa%2B1tRWOxu5FkPQN8Pl8TgyWZXGzogbRR06hu%2Bcxx2YUgGkWFriclQR3N5cp4R88bMfGwFAMDP5J%2FYwCELpjM%2BJiIg3K3IWcfMjjz%2BgHSIjbBxsbK72BvFe5wUHwIrXV%2FNgA2fa92nnF9RyIFr5MbXfv3UfS5xcxrNEgeFsQvDxWUttTlRouHv5aGxmcDEy2BWsrS9RXKWBrY01dDh7%2BBLmXr8LOzhYtdcWcpWs2bMXvfzzUPiNrbtd8C8sZM6iP36YQNDX%2FajjA1s0BOBl%2FYHwXT1VwWy2FSv0Mi0QLUFaYRW0qlRqLVvpygEoVmVjqJKLPdoVH40ZZteEAxd9kwHmpmAbIulSAQ0cTtfNlS8QoKcigtv6BQSyT%2BHEAivLSsdzZiT7bHSlHUen3hgGscHFC4ZV0TsD1AdtB3rNZABITYiDb5E8B6u80Q7plD52bNAMzbW3QUKWApeX4BxR18GPkKUrMA7Dr3UAck0dRsb7%2BQbz6uhRDQ8PmASgvyob4lflULC3zaxw7kcz5Hkz2CjzclyM%2FJ5WKkfOc%2FN%2F3H7SaByAlMQ7SjeupmO7Jp0tgkgyQG%2FGnygJMnz6NaoVFHcG14nLO7k32G4aFvIPY%2FaRAGh09vU8gWfMWNJq%2FTA%2FAMAyqb3yFl%2BYJqVjyuSycPJM2QdwkGfDxliA341MqNjIyAu91MrQ9UpoHID35ODb4%2BlCx8spabHtvv15xo2eA3Pe3KvJhYTFeUu0Mi8bN8tGbS98w6l%2FwfsRO7IsMpjodyi54rg3C8%2BcjkwIsFi%2FAd9fGr2NScCz%2Bl%2Bs4ODwGpWVV2pi0IOHzeagty4PjXAEVO530Bc6mXphUnBhm2c1Ec911js9q3y0g9R8ZpFi9U3MVVjr3iX9gKBp%2FucsF8JS44ko295gllPpKb7Kyta0DKeeztUEqSy5h4fx5FKKp5R7OpmRqy67QHTL4vCahNrX6GZw9%2FDE0PHqf0Ays9fHExbRTU%2B5W16hblu8JfhvyAxEGrc3%2BUoGYj05TX6MAkBMzPzcVri5LpoRoa1fCLzAEfX0DxgUg0UjtcDzuA7zpvw483sTuqrK6Dh%2FGnoCys5sDSVszUnQ4zLY3KI3EibxDZWfPBH%2FSknl5uELo6KBt87q6e3GrvpFWyboLWKDz%2F29Ox9pzlmEixppUg9PwHx21O2fZVNKe%2Fw1oS0dxT5BuXAAAAABJRU5ErkJggg%3D%3D&label=Zenless%20Optimizer"></a>
<a href="https://discord.gg/CXUbQXyfUs"><img alt="Discord" src="https://img.shields.io/discord/785153694478893126?color=%232a364d&label=DISCORD&logo=discord&style=for-the-badge"></a>
<a href="https://github.com/frzyc/genshin-optimizer/blob/master/package.json"><img alt="GitHub" src="https://img.shields.io/github/package-json/v/frzyc/genshin-optimizer?style=for-the-badge"></a>
<a href="https://github.com/frzyc/genshin-optimizer"><img alt="Github-last-commit" src="https://img.shields.io/github/last-commit/frzyc/genshin-optimizer?logo=github&style=for-the-badge"></a>
<a href="https://github.com/frzyc/genshin-optimizer/blob/master/LICENSE"><img alt="GitHub-license" src="https://img.shields.io/github/license/frzyc/genshin-optimizer?style=for-the-badge"></a>

A repo hosting a few different optimizer websites for different gacha games.

[Genshin Optimizer](https://frzyc.github.io/genshin-optimizer) is a helper website for the online action-rpg gacha game [Genshin Impact](https://genshin.hoyoverse.com/). It is intended to assist players with optimizing artifacts to max-min their characters, while providing a clean, structured UI, and provide real-time results.

[Zenless Optimizer](https://frzyc.github.io/zenless-optimizer/) is a helper website for the online action-rpg gacha game [Zenless Zone Zero](https://zenless.hoyoverse.com/). It provides basic disc optimization.

# WE NEED HELP!

Are you a web developer who is looking to contribute to the most over-engineered Genshin website ever made? Can you distinguish which one of the following is a pokemon?

```
React MaterialUI nx ekans GraphQL git metapod discord.js vite nodeJS emotion prisma Agumon tessract.js typescript bun sawk webpack jest
```

If you have knowledge in some(or any) of those techonology mentioned above, or are hoping to learn in an actively-developed app with thousands of users, please join our [Discord](https://discord.gg/CXUbQXyfUs)! We'd love to work with you.

## Gacha Optimizer Roadmap

Last updated Feb 2025

### Genshin Optimizer site [https://frzyc.github.io/genshin-optimizer/](https://frzyc.github.io/genshin-optimizer/)

- New characters and content will continue to be added as Genshin updates
- ~~Artifact upgrade damage probability calculator - Q1 2024~~
- ~~Teams + Loadouts - Q2 2024~~
- ~~Optimal substat solver for TC mode - Q2 2024~~

### Zenless Optimizer(alpha) site [https://frzyc.github.io/zenless-optimizer/](https://frzyc.github.io/zenless-optimizer/)

- ~~A (bare-bones) Optimizer for Zenless Zone Zero. Q1 2025~~
- Pando (New calculation engine) **TBD**
- Team/combo system **TBD**
- Complete addition of characters/discs/wengines to the system **TBD**

### SRO - GO but Star Rail

- ~~Pando (New calculation engine) Q4 2024~~
- ~~Team/combo system Q4 2024~~
- Complete addition of characters/relics/lightcones to the system **TBD**

### Somnia-bot

- ~~Access Genshin data from a bot Q3 2024~~
- Access your GO builds from a Discord bot **TBD**
- ~~Coming Q2 2024~~

## Code structure

GO is hosted as a monorepo.
Applications are in [/apps](/apps/)
Dependencies for the apps can be found in [/libs](/libs/).

For a more interactive and detailed view of the project, run `nx graph`.

### Applications

[`frontend`](/apps/frontend/) - Genshin Optimizer frontend - static website built using React with MUI, using the now deprecated Waverider calculation engine.

[`zzz-frontend`](/apps/zzz-frontend/) - Zenless Optimizer frontend - static website built using React with MUI, using a bare-bones calculation engine.

[`sr-frontend`](/apps/sr-frontend/) - WIP Star Rail optimizer frontend - static website built using React with MUI, using the Pando calculation engine.

[`somnia-bot`](/apps/somnia/) - WIP Discord bot - built using discord.js, using the Pando calculation engine.

### Notable Libs

[gi-good](/libs/gi/good/) - Interface for the Genshin Open Object Description (GOOD). An import format for Genshin scanners.

[sr-srod](/libs/sr/srod/) - Interface for the Star Rail Object Description (SROD). An import format for Star Rail scanners.

[gi-wr](/libs/gi/wr) - The (now deprecated) calculation engine for GI.

[pando](/libs/pando/engine/) - The new Optimizer calculation engine.

[gi-formula](/libs/gi/formula/) - The Genshin implementation of Pando.

[sr-formula](/libs/sr/formula/) - The Star Rail implementation of Pando.

[zzz-formula](/libs/zzz/formula/) - The Zenless implementation of Pando.

[gi-stats](/libs/gi/stats/) - Extracted Genshin numbers and values from the datamine, using Optimizer pipeline.

[sr-stats](/libs/sr/stats/) - Extracted Star Rail numbers and values from the datamine, using Optimizer pipeline.

[zzz-stats](/libs/zzz/stats/) - Extracted Zenless numbers and values from the ~~datamine~~ Hakush.in API, using Optimizer pipeline.

## Basic Setup

Install `yarn` ([link](https://yarnpkg.com/getting-started/install)).

Run `yarn` to install dependencies.

## Development server

Run `yarn run nx serve {frontend | sr-frontend | zzz-frontend}` for a dev server. Navigate to [http://localhost:4200](http://localhost:4200). The app will automatically reload if you change any of the source files.

## Understand this workspace

Run `yarn run nx graph` to see a diagram of the dependencies of the projects.

## Acknowledgments

✨ The tesseract model for GO was trained and provided by the creator of [Inventory Kamera](https://github.com/Andrewthe13th/Inventory_Kamera).

✨ The creator of Silly Wisher has granted us permission to incorporate their artwork into Silly Optimizer. Silly Wisher [discord](https://discord.com/invite/sillywisher), [App store](https://apps.apple.com/lv/app/silly-wisher/id6444465724https://apps.apple.com/lv/app/silly-wisher/id6444465724), [Google Play](https://play.google.com/store/apps/details?id=com.sketchi.sillywisher)

✨ This workspace has been generated by [Nx, a Smart, fast and extensible build system.](https://nx.dev)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=frzyc/genshin-optimizer&type=Date)](https://star-history.com/#frzyc/genshin-optimizer&Date)
