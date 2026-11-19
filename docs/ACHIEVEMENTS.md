# Achievements

The catalog, the unlock rules, and the art briefs. `src/core/achievements.ts` is generated from this
document — the id is the key, the name and description are shown in the grid, and the art brief is
what the artist reads.

## Rules

- **Ids are permanent.** They key the save file and the art file name, so an id never changes even if
  the name does.
- **Visible and shadow.** A normal achievement appears as a greyed tile with its name and condition
  readable before it is earned. A **shadow** achievement does not exist on the grid at all until it
  fires — no silhouette, no placeholder, no count. Cookie Clicker hides its shadows completely and
  that is the model.
- **The counter in the title bar reads `earned / total`, and the total does not move** when a shadow
  becomes visible. The grid simply has one more filled cell.
- **Nothing requires cheats.** A cheated run records no achievements except the three cheat-only
  shadows — `shadow-printer`, `shadow-cheat-lose` and `shadow-console` — whose condition *is* the
  cheating. Every other achievement is skipped on a cheated run.
- **Every achievement must be reachable in a real run** unless its description says otherwise. If a
  condition cannot be met on a shipped map, it is a bug in the condition, not a puzzle.

## The grid

The achievements dialog becomes a grid, not a list.

- Window 560 px wide, cells 52 × 52 with a 6 px gutter, **eight columns**. The grid scrolls; no
  pagination.
- Each cell is a 44 px icon centred on a beveled panel. Earned: full colour, panel raised. Unearned
  visible: the same icon at 30 % brightness under a sunken panel, with the name in grey.
- Hover (or click, on touch) shows a tooltip beside the cell: **name** on the first line, the
  condition on the second, and `Earned 2026-11-18` if it has fired.
- Hidden achievements have no cell. The grid compacts.
- A filter row above the grid: **All / Earned / Locked**, and a summary line
  `48 / 118 · 3 shadow`.
- Reduced motion drops the pop animation when a cell fills.

## Art

- One placeholder ships first: `public/art/achievements/_placeholder.svg`, a 44×44 beveled tile with a
  question-block glyph in the Win95 grey palette.
- `scripts/ach-art.mjs` copies it to `public/art/achievements/<id>.svg` for every id that does not
  already have a file. It never overwrites, so the artist can replace files one at a time and the next
  build keeps their work.
- A missing file falls back to the placeholder at runtime, so the grid never shows a hole.
- `docs/ART-STYLE.md` governs palette; icons are 16 px-grid vector art, two colours plus the bevel,
  readable at 44 px.

The shipped icons (2026-11-18) work to this contract. Keep it when you replace one:

- **`viewBox="0 0 44 44"`, with a raised Windows 95 button frame in every file.** The frame is the
  same bevel as `_placeholder.svg`: a `#c0c0c0` face, white and `#dfdfdf` on the top and left,
  `#808080` and black on the bottom and right, each one unit wide. The glyph is drawn in a 44-unit
  box and wrapped in `scale(0.84)` about the centre, so it sits inside the frame. The dialog
  multiplies the whole icon by `#4d4d4d` while it is locked, so a locked icon is a dark tile with a
  dim glyph.
- **Flat fills and a black 1.5-unit outline.** Colours come from the Windows 16-colour palette plus
  the game's own (tower identity colours, enemy blue-grey, shield cyan). Most icons use three or
  four colours, not two: the tier colours below need them.
- **Numerals are a 3×5 pixel font drawn as `<rect>`s, not `<text>`.** An SVG drawn as an image uses
  the fonts on the player's machine, so `<text>` does not look the same everywhere. Three characters
  is the most that reads at 44 px.
- **Related achievements share a motif and step through it.** Tiers go bronze `#c0803c`, silver
  `#dfdfdf`, gold `#ffcc00`, platinum `#9fe8ff`, violet `#c05cff`, with a numeral for the threshold:
  Roman on the wave medals (XXV, L, C, CL, CC), Arabic elsewhere. The families are the wave medals,
  the no-leak shields, the coin stacks, the target, the crit gauge, the power buttons, the chevrons,
  the tower roster, the price tags and the early-call arrows. The three cheat-only shadows share a
  magenta mark.
- **The unlock condition comes before the brief.** Where a brief below and a family motif disagree,
  the icon follows the family (for example `crit-hits` is a gauge, `map-import` is a floppy disk, and
  the wave icons are medals).

### Art briefs

Each brief describes one image, not a scene. Suggested shape: a single object or glyph, centred,
filling roughly 60 % of the tile.

## Catalog

### Pointer and the clicker

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `first-blood` | First Blood | First kill of any run | A single cracked enemy shell with a crosshair burn |
| `sharpshooter` | Sharpshooter | 100 weak-point hits in one run | A bullseye with three arrows dead centre |
| `weak-point-kills` | Deadeye | 50 weak-point kills in one run | A rifle scope over a shattered diamond |
| `crit-hits` | Lucky Streak | 25 critical hits in one run | A four-leaf clover made of cursor arrows |
| `crit-100` | Critical Mass | 100 critical hits in one run | A pressure gauge pinned past red |
| `pointer-1k` | Thousand Clicks | 1,000 pointer hits in one run | A mouse button worn shiny in the middle |
| `click-combo` | Combo Breaker | 10 kills in 10 seconds with the pointer | Three overlapping cursor trails |
| `override` | Manual Override | Kill a boss after overriding its targeting | A hand on a joystick, knuckles white |
| `pointer-only-wave` | Bare Hands | Clear a wave without building a tower that wave | A single cursor standing on an empty grid |
| `weak-point-10` | Getting the Point | 10 weak-point hits in one run | One arrow in the inner ring |
| `crit-first` | Beginner's Luck | Land a crit in the first wave | A single spark off a cursor tip |
| `overclock-max` | Overclocked | Buy every overclock tier in one run | A CPU die glowing at the edge of its heatsink |
| `click-idle` | Autopilot | Let the pointer run untouched for 60 s while towers kill | A cursor asleep on a mousepad |
| `pointer-boss-10` | Boss Hunter | Kill 10 bosses with the pointer, lifetime | Ten notches carved into a mouse shell |

### Towers

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `five-tier-five` | Five Tier Fives | Five tier-5 towers at once | Five gold chevrons stacked |
| `beacon-field` | Beacon Field | Ten beacons at once | Nine small antennae in a ring around one lit tower |
| `maxed-branch` | Maxed Out | Fully upgrade a branched tower | A tower with every lamp lit |
| `aa-flak` | Flak Jacket | Branch an AA tower into Flak | A shell bursting into a ring of shrapnel |
| `mine-layer` | Deminer | Trigger 25 mines in one run | A mine with a neat row of teeth |
| `wall-only-wave` | Brick by Brick | Clear a wave with walls and no damage towers | Three stacked bricks and a bent arrow |
| `toggle-master` | Gatekeeper | Toggle a shutter 50 times in one run | A shutter mid-swing with motion arcs |
| `repair-shop` | Handy | Spend 2,000 salvage on repairs in one run | A wrench crossed with a bandage |
| `tower-zoo` | Full House | Have one of every tower kind standing at once | A display shelf of nine tiny towers |
| `tier-five-first` | First of Five | Take any tower to tier 5 | A single gold chevron |
| `sell-10` | Liquidator | Sell 10 towers in one run | A price tag falling off a tower |
| `no-upgrade-wave` | Bare Bones | Clear wave 30 with no tower above tier 1 | A single bare tower on a wide grid |
| `laser-chain` | Beam Me Up | Kill 5 enemies with one Laser beam | A straight beam threading five rings |
| `frost-lock` | Deep Freeze | Keep 12 enemies slowed at once | A snowflake with a padlock |
| `taser-chain` | Chain Reaction | Tase 4 enemies with one shot | A lightning bolt forking four ways |
| `cannon-splash` | Splash Zone | Kill 6 enemies with one shell | A shell impact ring with debris |
| `cursor-first` | Utility Belt | Build a Cursor tower | A cursor with a wrench tucked under it |
| `cursor-repair` | Maintenance Window | Repair 5 towers with one Cursor | A cursor holding a tiny screwdriver |
| `beacon-buff` | Force Multiplier | Have a tower deal damage with 3 beacons boosting it | Three arrows converging on one tower |
| `one-kind` | One-Trick Pony | Clear a wave with a single tower kind on the board | One clean tower alone on a shelf |
| `two-kinds` | Double Threat | Clear wave 40 with exactly two tower kinds | Two towers back to back |
| `upgrade-first` | Tuned | Buy any tower upgrade | A screwdriver tightening a bolt |
| `branch-first` | Fork in the Road | Take any tower branch | A two-pronged road sign |
| `sell-tower-first` | Change of Plan | Sell a tower for the first time | A tower with a sold sign on it |

### Economy

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `salvage-peak` | Deep Pockets | Hold 1,000 salvage at once | A wallet bulging at the seam |
| `salvage-10k` | Loaded | Hold 10,000 salvage at once | A safe with the door ajar and light leaking out |
| `earn-100k` | Venture Capital | Earn 100,000 salvage in one run | A rising bar chart made of coins |
| `no-spend-wave` | Thrift | Clear a wave spending nothing | A piggy bank with its coin slot taped shut |
| `ad-collector` | Ad Collector | Dismiss ten ads in one run | A stack of pop-up windows, all closed |
| `ad-ignore` | Adblock | Let ten ads expire without closing them | A pop-up fading to grey on its own |
| `early-call-streak` | Speedrunner | Call three waves early in a row | Three chevrons accelerating to the right |
| `early-call-10` | Overclocked Clock | Call 10 waves early in one run | A clock with the hands bent forward |
| `early-call-wave-1` | Early Adopter | Call a wave early before building any tower | A start button pressed on an empty build bar |
| `idle-hour` | Background Task | Leave auto-wave running for 5 minutes untouched | A taskbar icon blinking quietly |
| `sell-profit` | Day Trader | Sell a tower in the same wave you built it | A tower under a price tag with a return arrow |
| `no-sell` | Pack Rat | Reach wave 20 without selling a tower | A dusty tower with cobwebs |

### Waves and survival

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `clean-wave` | Clean Wave | Clear a wave at 40+ with no leaks | A wave crest passing a shield untouched |
| `flawless-wave` | No Leaks | Clear a wave with zero leaks | A shield with no scratches |
| `flawless-10` | Spotless | Clear 10 waves with no leaks in one run | Ten polished shields in a row |
| `perfect-run` | Untouchable | Reach wave 50 without losing integrity | A full integrity bar with a crown |
| `long-road` | Long Road | Route length 50 or more | A coiled path with a marker flag |
| `maze-100` | Labyrinth | Route length 100 or more | A spiral maze filling the tile |
| `wave-25` | Quarter Century | Reach wave 25 | A silver chevron on a plinth |
| `wave-50` | Halfway | Reach wave 50 | A gold chevron on a plinth |
| `wave-100` | Centurion | Reach wave 100 | A laurel wreath of tiny towers |
| `endless-150` | Endless | Reach endless wave 150 | A path continuing past the edge of the tile |
| `endless-200` | Beyond | Reach endless wave 200 | A road sign reading simply ∞ |
| `integrity-1` | By a Thread | Survive a wave with 1 integrity left | A single cracked heart in a vice |
| `speed-3` | Fast Forward | Play a wave at 3× speed | Three forward arrows in a chrome housing |
| `wave-1-no-damage` | Untouched | Clear wave 1 without a single leak | A pristine first step on a staircase |
| `leak-recovery` | Rally | Clear five consecutive waves after losing integrity at least once | Five rising steps with a bandage on the first |

### Bosses

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `boss-by-pointer` | Boss by Pointer | Kill a boss with the pointer alone | A broken crown under a cursor |
| `milestone-boss-pointer` | Milestone Hunter | Kill a milestone boss with the pointer | A numbered seal with a cursor crack through it |
| `boss-10` | Boss Rush | Kill 10 bosses in one run | Ten small crowns on a rack |
| `boss-first-wave` | Early Grave | Kill a boss before wave 20 | A gravestone with a boss crown on top |
| `shield-break-5` | Shield Breaker | Break 5 boss shields in one run | A shield splitting down the middle |
| `carrier-brood` | Brood Mother | Kill a Carrier boss | A carrier shell with smaller shells spilling out |
| `dreadnought-kill` | Ironclad | Kill a Dreadnought | A battleship plate with a dent |
| `wirecutter-kill` | Cut the Wire | Kill a Wirecutter | Wire cutters over a severed cable |
| `ram-kill` | Roadblock | Kill a Ram boss | A ram's head stopped by a roadblock |
| `boss-no-leak` | Boss Proof | Kill a milestone boss without losing integrity | A crown behind a perfect shield |

### Prestige, meta and the machine

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `reboot-50` | Reboot | Reboot with 50 or more total specs | A power button mid-press |
| `two-reboots` | Second Boot | Reboot twice | Two power buttons side by side |
| `reboot-10` | Serial Reboot | Reboot 10 times | A row of ten power buttons |
| `specs-banked` | Nest Egg | Start a run with banked specs | A nest holding three glowing chips |
| `first-rp` | Restore Point | Earn your first Restore Point | A single blue chip with a Windows flag |
| `rp-100` | System Restore | Reach 100 lifetime Restore Points | A stack of chips under a restore-arrow |
| `prestige-25` | Version 2.0 | Reach prestige level 25 | A version stamp reading 2.0 |
| `tree-tier-3` | Branching Out | Buy any tier-3 tree node | A tree diagram with one lit branch |
| `tree-complete` | Fully Patched | Buy every node in the Restore tree | A circuit board with every trace lit |
| `fast-boot-40` | Cold Boot | Start a run at wave 40 | A monitor booting straight to the desktop |
| `no-cheats-100` | Honest Work | Reach wave 100 with cheats never used | A clean ledger with a wax seal |
| `all-help` | Well Read | Unlock every page in the Help viewer | A thick manual with every tab visible |

### Maps and the editor

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `custom-map-cleared` | Cartographer | Clear a wave on a custom map | A folded map with a route drawn on it |
| `editor-first` | Draftsman | Place your first tile in the editor | A pencil over an empty grid |
| `map-export` | Shareware | Export a map code | A floppy disk with a share arrow |
| `map-import` | Import Duty | Load a map from a code | A box being opened on a loading dock |
| `fork-cleared` | Split Decision | Clear wave 10 on The Fork | A road forking around a median |
| `ladder-cleared` | Rung by Rung | Clear wave 10 on The Ladder | Two ladders joined by a rung |

### Shadow

Shadow achievements do not appear until earned. They are for the odd, the silly and the stubborn.

| id | Name | Unlock | Art brief |
|---|---|---|---|
| `shadow-ad-no-close` | Customer Service | Let ten ads expire, then lose the run | A stack of unopened envelopes in a bin |
| `shadow-zero-towers` | Pacifist | Reach wave 5 with no towers and no clicks | An empty board with a single blade of grass |
| `shadow-all-walls` | Wall Street | Build 40 walls in one run | A brick wall wearing a tie |
| `shadow-sell-all` | Fire Sale | Sell every tower at once from a full board | A shop with every shelf empty |
| `shadow-1hp-boss` | Photo Finish | Kill a boss while at 1 integrity | A trophy on a cracked shelf |
| `shadow-pause` | Coffee Break | Pause the game for 10 minutes | A coffee cup ring on a desk |
| `shadow-hover` | Window Shopper | Hover a tooltip for 60 seconds | A mouse cursor resting on a shop window |
| `shadow-resize` | It Fits | Play a full wave in a 800×600 window | A window dragged small but intact |
| `shadow-mute` | Silent Running | Clear wave 50 with sound off | A speaker with a finger over it |
| `shadow-reload` | Have You Tried Turning It Off | Reload mid-wave and finish it | A boot screen half-drawn |
| `shadow-clippy` | It Looks Like You're Writing a Game | Open every Help page without playing a wave | A paperclip peeking over a manual |
| `shadow-monochrome` | High Contrast | Finish a run with screen shake off | A black-and-white monitor |
| `shadow-owl` | Night Shift | Clear a wave between 2 and 4 am local | An owl on a monitor stand |
| `shadow-weekend` | Weekend Warrior | Clear a wave on a Sunday | A calendar page with one circled day |
| `shadow-flat-battery` | Low Battery | Start a run while the OS reports battery below 10 % | A battery icon at one bar |
| `shadow-boots` | Blue Screen | Reboot while at wave 1 | A blue error screen with a sad face |
| `shadow-perfect-100` | Immaculate | Reach wave 100 with no leaks, no repairs, no sells | A pristine shield under glass |
| `shadow-every-map` | Tour Guide | Clear a wave on all six shipped maps | Six tiny maps pinned to a board |
| `shadow-help-clippy` | Paperclip | Open the Help window during a boss fight | A paperclip riding a boss |
| `shadow-drag` | Where Did It Go | Drag the Help window off screen and back | A window half past the edge |
| `shadow-tooltip` | Read the Manual | Open every tower tooltip in one run | A tooltip with a bookmark |
| `shadow-printer` | Paper Jam | Spawn 50 enemies from the cheat menu, then lose | A printer eating a sheet |
| `shadow-cheat-lose` | That Was Fair | Use a cheat and still lose the run | A crown falling off a cheat code |
| `shadow-console` | Cheated Cookies Taste Awful | Use the cheat menu at all | A cookie with a keyhole cut into it |
| `shadow-broke` | Zero Balance | Hit zero salvage and have a tower go offline in the same wave | An empty wallet with a receipt |

## Open questions, decided

- **How many is too many?** 118 is the shipped count: 93 visible plus 25 shadow. More than that and the grid stops being readable at 8 columns; add a second row of
  filters before adding cells.
- **Do shadows count toward the total?** Yes in the stored total, no in the pre-earn display. The
  header reads `48 / 118 · 3 shadow` so a player can see shadows exist without seeing what they are.
- **Local time for the clock-based shadows.** `shadow-owl` uses the browser's local clock, which is
  the only clock a serverless game has. It is a joke achievement; do not build a timezone service for it.
