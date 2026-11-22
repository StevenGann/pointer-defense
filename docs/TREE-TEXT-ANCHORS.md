# Tree tab: two rows are indented like tier headers

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `73a3998`.
Reported from a screenshot: "System Properties is still a little wonky."

## What is on screen

On the Tree tab, **Warm Cache** and **A.A. Licence** — the 4th and 7th node rows — draw their names
about 20 px further left than every other node, overlapping the guide line and the checkbox column,
and their prices sit further right than the rest.

## Why

`drawTreeTab` borrows text objects from one pool (`this.rows`) and never sets their anchor for node
names — it only sets `position`. A pooled object keeps whatever anchor it last had. The Specs tab's
level digits set `anchor.set(0.5, 0.5)`, and the pool index those digits occupied in the Specs pass
is exactly the index the 4th and 7th node names occupy in the Tree pass, so those two names render
centred on their x instead of starting at it.

The price text has a second version of the same fault: it sets `anchor.set(1, 0.5)`, positions at the
right edge, then sets `anchor.set(0, 0.5)` — the anchor that puts the glyphs *past* the pane edge and
under the frame.

## The fix

Every pooled text sets its own anchor **before** it is positioned, in every branch:

- tier label: `anchor.set(0, 0.5)`, x = `rect.x + 26`
- node name: `anchor.set(0, 0.5)`, x = `rect.x + 46`
- price: `anchor.set(1, 0.5)`, x = `rect.x + rect.w - 6`, and the anchor is **not** reset afterwards
- the Specs level digit keeps `anchor.set(0.5, 0.5)` and the same rule

Make the placement a small exported helper (`treeRowTextX(row)` / `TREE_TEXT_ANCHOR`) so the smoke
harness can assert it without a canvas, and use it from the draw.

Also: the first row currently sits flush against the tab body's top border and the Tier 1 expander
reads as colliding with it. Start the tree 4 px down.

## Tests

- The helper returns anchor 0 for tier labels and node names, 1 for prices.
- For every built tree row, the price's left edge (`x - textWidth`) is inside the tab body, i.e. no
  price can be clipped by the frame at any width the dialog supports.
- A node name and a tier label never share an x (they are indented by different amounts).
- Drawing the Tree tab after the Specs tab leaves every node name at its documented anchor — asserted
  on the helper, since the pool is view-side state.

## Out of scope

The tree data, the guide-line style, tier gating and the Apply/Close wiring.
