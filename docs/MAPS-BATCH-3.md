# Stock maps, batch 3

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `e7134d2`.

Seven new maps, ten to seventeen. Every geometry below was measured against the shipped
`validateLevel`, the real `buildField`, and `canPlace` on a real run state — the numbers are what the
game produced, not what the sketch intended.

## The seven

| id | name | buildable | route | tiles next to the route | walls |
|---|---|--:|--:|--:|--:|
| `comb` | The Comb | 168 | 70 | 72 | 72 |
| `shelves` | The Shelves | 155 | 73 | 46 | 85 |
| `pinwheel` | The Pinwheel | 198 | 28 | 94 | 47 (42 unique) |
| `twin-halls` | Twin Halls | 206 | 28 | 126 | 34 |
| `ziggurat` | The Ziggurat | 174 | 30 | 29 | 66 |
| `gauntlet` | The Gauntlet | 196 | 30 | 87 | 44 |
| `quarry` | The Quarry | 128 | 30 | 87 | 112 |

Two long serpentines (70 and 73 tiles), four in the high twenties or thirty, and one dense brawl map.
Buildable tiles run from 128 to 206, all seven pass `validateLevel`, and every one has a proven
`canPlace` — the map is playable, not merely legal.

None uses authored routes and none uses toggles: these are terrain maps, and the player's own walls
do the mazing on top.

## Geometry

Reproduce these exactly. `v` is a vertical run, `h` a horizontal run, `b` a filled block, all
inclusive, all 0-based on the 20 x 12 board. Pinwheel's four L-blocks overlap at five corners, so
its list repeats five coordinates; leave them, they are harmless and changing the geometry would
change the measured numbers.

```ts
// The Comb: teeth from the top edge and the bottom edge, interleaved.
comb: [
  ...v(4, 0, 7), ...v(8, 0, 7), ...v(12, 0, 7), ...v(16, 0, 7),
  ...v(2, 4, 11), ...v(6, 4, 11), ...v(10, 4, 11), ...v(14, 4, 11), ...v(18, 4, 11),
], starts [{0,0}] exits [{19,11}]

// The Shelves: five long shelves, alternating which edge they hang from.
shelves: [...h(2, 0, 16), ...h(4, 3, 19), ...h(6, 0, 16), ...h(8, 3, 19), ...h(10, 0, 16)],
starts [{17,0}] exits [{19,11}]

// The Pinwheel: four L-blocks, each rotated a quarter turn.
pinwheel: [
  ...h(3, 2, 8), ...v(8, 0, 3),
  ...v(11, 2, 8), ...h(2, 11, 17),
  ...h(8, 11, 17), ...v(11, 8, 11),
  ...v(8, 8, 11), ...h(8, 2, 8),
], starts [{0,5}] exits [{19,6}]

// Twin Halls: two halls joined by two necks, a block in each corner of each hall.
twin-halls: [
  ...v(10, 0, 4), ...v(10, 7, 11),
  ...b(3, 5, 2, 3), ...b(3, 5, 7, 8),
  ...b(14, 16, 2, 3), ...b(14, 16, 7, 8),
], starts [{0,1}] exits [{19,10}]

// The Ziggurat: three stepped frames, each open on a different side.
ziggurat: [
  ...h(1, 1, 18), ...v(1, 2, 10), ...v(18, 2, 9),
  ...h(3, 4, 15), ...v(4, 4, 8), ...v(15, 4, 7),
  ...h(5, 7, 12), ...v(7, 6, 7), ...v(12, 6, 7),
], starts [{9,0}] exits [{10,11}]

// The Gauntlet: eleven 2x2 pillars on a stagger.
gauntlet: [
  ...b(3, 4, 2, 3), ...b(7, 8, 2, 3), ...b(11, 12, 2, 3), ...b(15, 16, 2, 3),
  ...b(5, 6, 5, 6), ...b(9, 10, 5, 6), ...b(13, 14, 5, 6),
  ...b(3, 4, 8, 9), ...b(7, 8, 8, 9), ...b(11, 12, 8, 9), ...b(15, 16, 8, 9),
], starts [{0,0}] exits [{19,11}]

// The Quarry: four big blocks with a cross of open lanes between them.
quarry: [...b(2, 8, 2, 5), ...b(11, 17, 2, 5), ...b(2, 8, 7, 10), ...b(11, 17, 7, 10)],
starts [{0,0}] exits [{19,11}]
```

## Names and localisation

New catalogue keys, one per map, in all seven catalogues:

- `level.comb.name` = The Comb
- `level.shelves.name` = The Shelves
- `level.pinwheel.name` = The Pinwheel
- `level.twinHalls.name` = Twin Halls
- `level.ziggurat.name` = The Ziggurat
- `level.gauntlet.name` = The Gauntlet
- `level.quarry.name` = The Quarry

English is authoritative. In the six non-English catalogues put the English name in place and keep
`draft: true`; a translation run follows this one. Map **ids** are identifiers and never translate.

## Tests

- All seven validate and are appended to `LEVELS`; the gallery holds seventeen.
- Each map's route length and buildable count match the table exactly, measured through the real
  field rather than a re-implementation.
- A `canPlace` proof per map on a real run state, and at least one tile next to each route.
- The gallery draws seventeen cards, scrolls to the last one, and the scrollbar thumb is proportional.
- Two maps never share a wall set or a route length where the table says they differ.

## Out of scope

No new art, no new mechanics, no toggles, no authored multi-lane routes, no rebalancing of the
existing ten maps.
