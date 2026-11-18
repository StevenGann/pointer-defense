# Architecture

## Stack

| Piece | Choice | Why |
|---|---|---|
| Language | TypeScript, strict | the game is state and numbers |
| Bundler | Vite | fast dev server, static output for Pages |
| Renderer | PixiJS v8 | WebGL/WebGPU, SVG art rasterised to sprites + vector Graphics API |
| Hosting | GitHub Pages | static, free, one workflow |

There is no server. The game is a single page that runs entirely in the browser, and any persistence
is `localStorage`.

## Layout

```
src/
  main.ts          boot: create the app, mount the scenes
  style.css        body and canvas only; the chrome is drawn in Pixi
  core/            pure game logic, no rendering
    grid.ts        tiles, buildability, the path
    waves.ts       wave definitions and spawn scheduling
    enemies.ts     enemy types and stats
    towers.ts      tower types and stats
    economy.ts     salvage, costs, kill attribution
    pointer.ts     the cursor's damage profile, overclock ladder, crits and the mark
    state.ts       the run state and its reducers
  view/
    board.ts       draws the grid, towers, enemies
    chrome.ts      Windows 95 window frames, title bars, buttons
    hud.ts         money, wave, pointer stage
  input/
    mouse.ts       clicks, placement, targeting
```

`core/` never imports from `view/`. The simulation is driven by a fixed timestep so the game behaves
the same at any frame rate, which matters because a clicker's numbers are sensitive to time.

## Rules for the code

- **Fixed art is SVG.** Enemies, towers, branch marks and the board are SVG files rasterised to
  sprites (see `public/art/README.md`); runtime effects are Pixi `Graphics` calls or a `Text`.
- **No HTML UI.** The page is a canvas host. Windows, buttons and panels are drawn in Pixi so that
  the whole game is one coordinate space and one render loop.
- **Fixed timestep, 60 Hz.** Rendering interpolates. Never advance the simulation with `deltaTime`.
- **Data, not code, for content.** Tower and enemy stats live in tables so balance is editing, not
  refactoring.

## Deployment

`.github/workflows/deploy.yml` builds on push to `main` and publishes `dist/` to GitHub Pages using
the official Pages actions. No secrets are required; the workflow uses the repository's own token.

Project site URL: `https://stevengann.github.io/pointer-defense/`, so Vite's `base` must stay
`/pointer-defense/`.
