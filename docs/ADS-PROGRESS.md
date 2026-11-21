# Ad progress bar

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `15403a0`.

A desktop ad lives for eight seconds and then vanishes with nothing on it saying so. The System Tray's
System Update pop-up already answers this with a thin bar along the bottom of its body
(`TrayView.draw`, `src/view/ad.ts`), so the ads should use the same idiom rather than invent a second
one.

## 1. The bar

- A 3 px bar along the bottom of the ad's body: `x + 6` to `x + w - 6`, `6` px above the inner
  border, with the track in `PAL.shadow` and the fill in `PAL.title` — exactly the tray's colours and
  height.
- The fraction is `ad.ttl / AD_LIFETIME_TICKS`, clamped to 0..1, and the filled width is rounded to
  whole pixels. While `ttl > 0` the fill is at least 1 px, so the bar never reads as finished before
  the ad actually goes.
- Under RTL the fill grows from the right edge, mirrored like every other progress element. The
  track's rect does not move.
- It is drawn for every kind, Blue Screen included. The trap's only tell stays the title text sitting
  one pixel high; a missing bar would be a second tell and an easy one.

## 2. The dialog grows

The tip block already runs to `y + 89` of a 92 px dialog, so there is nowhere to put a bar without
overlapping the third line. Grow the dialog to **220 x 98**: `AD_H` 92 -> 98, `AD_W` unchanged.

- The reward line does not move (`REWARD_LINE_OFFSET` stays 19 px below the title bar), the separator
  stays 8 px below it, and the tip block keeps its 11 px text and three-line maximum.
- The bar occupies `y + h - 9` to `y + h - 6`, inside the 2 px bevel.
- The tip's last line must clear the bar by at least 2 px, asserted rather than eyeballed.

## 3. What does not change

- The ad's position within its region is still chosen by the sim and clamped against the board's
  margin; only the height changes, and the margin clamp already reads `AD_H`.
- Hit-testing: the clickable frame is the ad's rect. The bar is decoration and adds no hit target.
- Nothing in the simulation reads the bar. It is drawn from `ad.ttl` and nothing else, so a run's
  outcome cannot depend on it.

## 4. Tests

- `AD_H` is 98 and `AD_W` is 220, with the assertion's comment updated rather than deleted.
- The bar's rect sits inside the bevel and 6 px from each side, and is returned by an exported helper
  so input and view cannot drift apart.
- Fill fraction: full at `ttl = AD_LIFETIME_TICKS`, half at half, one pixel at `ttl = 1`, zero at 0.
- The tip block's last line clears the bar by 2 px at three wrapped lines.
- RTL mirrors the fill and leaves the track where it was.
- The Blue Screen draws the bar.
- A run that dismisses an ad at the same tick produces the same state as before this change, apart
  from the ad's height — the bar must not alter the sim.

## 5. Out of scope

No countdown text, no seconds remaining, no sound, and no change to the tray pop-up's own bar.
