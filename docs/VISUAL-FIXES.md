# Visual pass: the defects found on screen

Four defects from a first look at the built screens. Each is visible in a screenshot; none is caught
by the existing tests, which test geometry and not ink.

1. **Tab captions are blank** in Global Upgrades and System Properties. `drawTabStrip` draws the tab
   shapes and the views never draw the labels. Every tab gets a Text: `Available`, `Owned`;
   `Restore Point`, `Specs`, `Tree`. The label is centred in its tab, 11 px, `PAL.text` when active
   and `PAL.shadow` when not.
2. **OK / Cancel / Apply / Close captions are blank** in both property sheets. Same cause. Each
   button's label is centred, 13 px, and the default button (OK / Restart Windows) carries the
   1 px dotted focus ring.
3. **Global Upgrades shows an empty list with a status bar claiming 14 upgrades.** Nothing is
   *unlocked* at wave 2 — the filter is right, the presentation lies. The status line becomes
   `3 of 14 unlocked · 0 owned`, counted from `revealedUpgrades` and `GLOBAL_UPGRADES`. When the
   visible list is empty, the list body prints one centred 11 px line: `No upgrades unlocked yet.`
   and, when there is a next one, `The next unlocks at wave 8.`
4. **The main menu's tip marquee is not clipped** and scrolls straight across the window and the
   desktop. Mask it to its 18 px strip. The status bar's right panel is also clipped —
   `Best wave 0 · 0 runs · 0/118 achievements` must fit: shorten to `Best 0 · 0 runs · 0/118` and
   size the panel from the measured text.
5. **The Help tree has no expanders.** Add the 9×9 `[+]` / `[-]` boxes with 1 px black borders and
   a drawn plus or minus, indented 12 px per level, and the dotted guide lines the spec asked for.
6. **The Help status bar shows the path twice**: `Getting started › Getting started`. It shows the
   topic path once.

Also check the System Properties progress bar: with zero points it must be empty, not a quarter full.

## Tests

- Every tab and button in all four layouts carries a non-empty `label`, and the test names the screen
  when one does not.
- The upgrades status counts revealed, not total, and the empty-state line appears exactly when the
  list is empty.
- The marquee mask rectangle equals the marquee rect.
- The Help topic path contains the topic name once.
