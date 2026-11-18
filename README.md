# Pointer Defense

**Play: <https://stevengann.com/pointer-defense/>** — runs in the browser, nothing to install.

A hybrid tower defense and clicking game: towers build a maze that holds the lane, and your mouse
is the weapon that turns every kill into salvage.

## How to play

Enemies stream from the left edge to the right edge along the shortest open route. Placing towers
blocks and bends that route, so a good maze keeps enemies inside your tower ranges for longer.
You have 20 integrity; every enemy that leaks off the right edge costs some. At zero, the run ends.

You are not just building — you are also shooting. Click enemies to deal damage directly. Every kill
pays salvage, the currency for towers, upgrades and pointer upgrades, and a kill pays more when you
land the finishing blow yourself (1.5x). Aim for an enemy's **weak spot**, the small notch on its
leading edge, for double damage and a growing combo multiplier.

Between waves, spend your salvage. Desktop ads appear during waves and offer free salvage, a
free tower, or a buff — but they expire if you ignore them. Clearing waves builds lifetime salvage;
choose **Restart Windows** from the File menu to bank it as **specs**, permanent upgrades that carry
into every future run.

## Controls

| Key | Action |
| --- | --- |
| Mouse | Click to place towers and shoot enemies; right-click cancels a selection |
| Auto checkbox | Start the next wave 1.5 s after the board clears (holds while a tower repairs) |
| `1`–`9` | Select the nine tower kinds, in palette order (also works during a wave) |
| `Esc` | Clear the current selection and close any open menu |
| `U` | Upgrade the selected tower |
| `X` | Sell the selected tower |
| `Enter` | Start the next wave (in the build phase) |
| `P` | Pause / resume |
| `Space` | Cycle the simulation speed |

Towers unlock as the run progresses, so the palette starts small. Gun and Wall are available from the
start; Cannon unlocks at wave 4, Frost at 6, Beacon at 8, Laser at 11, Taser at 14, Repair at 18 and
Cursor at 24. A locked tower stays visible in the palette, greyed out, and its tooltip (or a keypress
on its number) tells you which wave it arrives in.

## Development

Requires Node 22.18 or later (TypeScript types are stripped natively, no build step for the scripts).

```
npm install
npm run dev                     # local dev server
npm run build                   # type-check and bundle to dist/
npm run smoke                   # headless simulation checks
npm run balance -- --to 100     # headless balance harness
npm run balance -- --call-sweep # early-call trade curve at 25%, 50% and 75%
npm run balance -- --clicker    # pointer clicker (2 clicks/s + pointer levels) vs. no-click
npm run balance -- --cursor     # standard plan + two cursors vs. the standard plan
```

Flags after `--` are passed through to the script, because `npm` would swallow them otherwise.

## Technical notes

Browser game built with TypeScript, Vite and PixiJS. Everything is drawn as vectors at runtime —
there are no sprite sheets. The simulation core in `src/core` is deterministic and side-effect free,
so `scripts/smoke.mjs` and `scripts/balance.mjs` run it headlessly on Node. See
[`docs/design.md`](docs/design.md) and [`docs/architecture.md`](docs/architecture.md).

## Licence

MIT. See [LICENSE](LICENSE).
