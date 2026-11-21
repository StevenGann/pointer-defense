# Remove the enemy facing tick

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `5ef44e8`.

Every enemy carries a short white tick on its leading edge (`src/view/board.ts:2288-2296`, comment
"Weak-point notch"). It was written when enemies were procedural silhouettes and needed something to
say which way they faced. They now have their own art, oriented by `ENEMY_ART_ROTATES`, so the tick
reads as a stray mark on a finished sprite.

**What it is not:** the tick is not only a facing indicator. It marks the weak point, where a pointer
click pays double (`src/core/pointer.ts:91`, `docs/ART-STYLE.md:143`). Removing the tick does not
remove the weak point — the geometry is computed in the core from the enemy's heading and never reads
the drawing. It does remove the only *pre-hit* sign of where it is; after this change the weak point is
learned from the doubled damage label on impact. That is the trade Sydney asked for, and it is the
whole trade.

## 1. The change

- Delete the notch block in `drawEnemy`/`drawEnemyShape`'s caller — the `moveTo`/`lineTo` stroke in
  `PAL.highlight` at `r * 0.7` to `r * 1.08` along `e.heading`.
- Nothing else in the enemy pass moves: sprite, shield ring, auras, health bar, boss crown and Ram
  drill all keep their order.

## 2. Documentation

- `docs/ART-STYLE.md:143` still lists the notch as "a short white tick on the leading edge". Replace
  that row's description with the truth: the weak point is unmarked on screen and reads through the
  doubled damage number.
- No Help page mentions the tick — check before claiming that, and correct it here if one does.

## 3. Tests

- The weak-point mechanic is untouched: a click on the leading edge still crits at the same rate, and
  the existing weak-point assertions keep passing unchanged.
- The enemy draw pass emits no stroke in `PAL.highlight` — asserted by the absence of the block where
  a unit test can see it, or by the smoke suite's existing enemy-art group continuing to pass with the
  tick gone.
- No new strings, no new art.

## 4. Out of scope

Rotating sprites, weak-point geometry and reward, boss crowns, and the Ram's drill.
