# Menu submenus

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `be559ad`.

The Cheats menu draws its Spawn list as a permanent second column (`OpenMenu.secondColumn`). Opening
Cheats therefore opens all fifteen spawn entries at once: the dropdown is twice as wide as any other
menu, the list dwarfs the two actual cheats beside it, and there is no way to dismiss it without
closing the menu. It should be a nested submenu, the way a Windows menu has always done this.

This removes `secondColumn` from the model rather than special-casing it: it exists for this one menu
and nothing else uses it.

## 1. Model

`MenuEntry` gains `submenu?: MenuEntry[]`. `OpenMenu` loses `secondColumn`.

The Cheats menu becomes a single column:

- God mode (checked)
- Kill all
- separator
- Spawn ▸ — a parent entry whose `submenu` is the fifteen spawn kinds, ids unchanged
  (`spawn:<kind>`), so `menuAction` and `SPAWN_PREFIX` need no change.

The parent is enabled. A parent with an empty or missing `submenu` behaves as a normal item.

## 2. Layout

- `computeMenu` reserves a chevron column at the right edge of any row that has a submenu — 14 px,
  mirrored to the left edge under RTL — so a label never runs under the chevron. Width is computed
  from the widest row including that column.
- The flyout opens with its left edge on the parent menu's right edge, and its top on the parent
  row's top. Under RTL it opens with its right edge on the parent's left edge.
- If the flyout would cross the right edge of the game window (left under RTL), it opens on the
  opposite side of the parent menu instead.
- The flyout's bottom is clamped inside the window: if it would overflow, it shifts up, never past
  the menu bar.
- If it is taller than the whole client area even after clamping, it splits into two equal columns
  inside one flyout rect, filling the left column first, top to bottom. This is the only case where
  a flyout is wider than one column.

The flyout rect is returned as `submenu: { rect, items, parentId } | null` on `MenuLayout`.

## 3. Behaviour

State lives with the open menu: `submenuParentId: string | null`.

- **Open** on hover after 250 ms over the parent row, and immediately on click of the parent.
- **Close** when the pointer leaves the parent row and is not inside the flyout; when another row in
  the parent menu is hovered; on Escape (which closes the flyout first and the menu on the second
  press); when the menu closes; and after any item is chosen.
- The parent row stays highlighted while its flyout is open, and while the pointer is inside the
  flyout.
- Clicking an item in the flyout dispatches its id exactly as today and closes both the flyout and
  the menu.
- Moving the pointer from the parent row into the flyout must not close it — the 250 ms timer is not
  re-armed on the way.

Keyboard, when the menu is open: Up/Down move the highlight, Right opens the highlighted submenu and
moves into it, Left closes it and returns to the parent, Enter activates (opening a submenu, or
choosing an item), Escape as above. Keys must not reach the game while a menu is open.

## 4. Drawing

The flyout uses the same face, bevel and shadow as the dropdown, 1 px outside border included. The
chevron is a 4 px triangle drawn in `Graphics` in the text colour, dimmed on a disabled parent. The
flyout is drawn above the menu and above the game, and is not clipped by the menu's own rect.

## 5. What not to change

The View menu's Language group stays inline: seven short names, all visible, is what Windows does
for a language list, and a submenu there costs a click for nothing. Do not touch the menu bar words,
their order, the separators, the check marks, or the existing close-on-outside-click path.

## 6. Tests

- A row with a submenu reserves the chevron column; a row without one does not.
- The flyout opens to the right in LTR and to the left in RTL, aligned to the parent row.
- It flips to the other side at the window edge, on both sides.
- It clamps its bottom inside the window.
- A list too tall for the window splits into two balanced columns.
- Hovering the parent for 250 ms opens it; leaving before 250 ms does not.
- Moving from the parent into the flyout keeps it open.
- Hovering another row closes it.
- Escape closes the flyout first, then the menu.
- A spawn item's id still resolves to a spawn action with the id unchanged.
- The Cheats menu now has exactly one column, and no menu has `secondColumn`.
