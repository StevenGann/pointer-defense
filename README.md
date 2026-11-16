# Pointer Defense

A tower defense game where clicking is the economy and towers are the time to click.

Towers hold the lane. You click the leaks. Every kill pays better if you landed the blow, so the
shipment of upgrades depends on how well you shoot, and the survival of the lane depends on how well
you built.

**Play:** https://stevengann.github.io/pointer-defense/

Browser game. TypeScript, Vite, PixiJS. Everything is drawn as vectors at runtime; there are no sprite
sheets. The chrome is Windows 95 and the board is Desktop Tower Defense.

## Status

Pre-alpha. Scaffolding and the design document exist; the game does not.

## Develop

```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and bundle to dist/
```

## Design

- [`docs/design.md`](docs/design.md) — the game.
- [`docs/architecture.md`](docs/architecture.md) — how the code is laid out.

## Licence

MIT. See [LICENSE](LICENSE).
