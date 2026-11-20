# Map selection

Status: spec, not built. Owner: Guppy. Written 2026-11-20. Queue position 3.

Pressing **Play** starts `LEVELS[0]` today (`main.ts`, `doPlay` → `startRun(DEFAULT_LEVEL)`). Five
other authored maps ship in `src/core/levels.ts` — Corridor, Dumbbell, Open Field, Turnstile, Fork,
Ladder — and the only way to reach one is the editor or a seed. A player who never opens the editor
never sees five sixths of the content.

## What ships

A new `maps` screen between the main menu and a run.

- **Play** opens the gallery instead of starting a run. **Continue** still resumes a saved run and does
  not go near the gallery. **Daily** and **Editor** keep their own entry points.
- The gallery is a grid of cards, one per entry in `LEVELS`, in `LEVELS` order.
- Each card: a thumbnail, the map's name through `t('level.<id>.name')`, and one line of history from
  the profile — best wave reached on this map, or `Not played` when there is none.
- Click or `Enter` starts the chosen map with `startRun(level, 'play')`. `Esc` returns to the menu.
- Arrow keys move focus by grid position; `Home`/`End` jump to the first and last card.

## Thumbnails are generated from the map data

No art files. A thumbnail is drawn from the same `Level` the run will use, so it cannot drift from
the map it advertises.

- `levelThumbnail(level)` in `src/core/thumb.ts` returns a small description: for each of the 20×12
  tiles, whether it is wall, route, spawn, exit or open. Pure, deterministic, no Pixi.
- Route tiles come from the existing pathfield over the level's own walls, not from a second
  pathfinder. A level with authored `routes` uses those tiles.
- The view rasterises that description once per level into a cached `Texture` at 6 px a cell (120×72),
  keyed by level id. It is created on first use and reused; the gallery draw path allocates nothing
  per frame.
- Wall cells are `PAL` dark, route cells a mid tone, open floor the panel background, spawn and exit
  two small markers in their existing board colours. The thumbnail is read-only: it does not spawn
  entities or mutate the level.

## Layout

Six cards, three across and two down, inside the existing menu client area — no new window size, so
the gallery inherits the chrome, the title bar and the RTL mirroring that already work.

- Card 196×146, gap 12, thumbnail 120×72 at the top, name at 13 px below it, history at 11 px beneath
  that. Focused card draws the same 2 px focus ring the menu buttons use.
- The grid is built from `direction.ts`: in RTL the cards run right to left, and arrow keys follow the
  visual order rather than the array order. Nothing else mirrors.
- Names come from the existing catalogue; the two new labels are `shell.maps.title` and
  `shell.maps.best` (`Best: wave {n}` / `Not played`). All seven locales get draft strings.
- If the profile has no runs, every card says `Not played`; the gallery never hides a map.

## Selection is remembered, not enforced

`pd.map.v1` stores the last map started from the gallery, and the gallery opens with focus on it. A
map is selected, never unlocked: all six are playable from the first launch. Difficulty is a property
of the map, not a gate, so there is no lock icon and no progression state to get wrong.

## Tests

- Every level produces a thumbnail; two different levels never produce the same cell description.
- The description is stable across calls and across a reload (it is derived, not drawn).
- The gallery fits the client area with six cards at 1280×720 in all seven locales: no card overlaps
  its neighbour, no name or history line overflows its card.
- Keyboard focus order matches visual order in both directions, and `Enter` on a focused card starts
  that level's run (asserted on the `startRun` argument, not on a screenshot).
- `Esc` from the gallery returns to the menu; `Play` from the menu reaches the gallery and does not
  start a run.

## Not in scope

- Previews that animate, minimaps during a run, or a map editor entry in the gallery.
- Unlocks, stars, difficulty tiers, or a second page of cards.
