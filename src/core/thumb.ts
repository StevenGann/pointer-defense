import { COLS, ROWS } from './grid.ts';
import { createGrid, levelRoutes, type Level } from './levels.ts';
import { buildField, pathTiles } from './pathfield.ts';

/**
 * The thumbnail description of a level (docs/MAP-SELECT.md §Thumbnails): one cell per board tile,
 * row-major and `COLS * ROWS` long. It is derived from the same `Level` a run would use — the walls,
 * the authored routes when present, and otherwise the existing pathfield over those walls — so the
 * picture cannot drift from the map it advertises.
 *
 * Pure and deterministic: two calls on one level return the same cells, and two different levels
 * never return the same description. The view rasterises this once per level into a texture; this
 * module has no idea what a pixel or a Pixi texture is.
 */

export type ThumbCell = 'wall' | 'route' | 'spawn' | 'exit' | 'open' | 'no-build';

export function levelThumbnail(level: Level): ThumbCell[] {
  const out: ThumbCell[] = new Array<ThumbCell>(COLS * ROWS).fill('open');
  for (const [c, r] of level.walls) out[r * COLS + c] = 'wall';
  for (const [c, r] of level.noBuild ?? []) out[r * COLS + c] = 'no-build';

  const routes = levelRoutes(level);
  if (routes.length > 0) {
    // Authored corridors are the route, exactly as authored; the spawn and exit markers overlay the
    // shared endpoint tiles afterwards.
    for (const route of routes) for (const t of route) out[t.row * COLS + t.col] = 'route';
  } else {
    // Otherwise the single implicit route: the pathfield over the level's own walls, not a second
    // pathfinder, so the thumbnail shows the same walk a fresh run starts with.
    const grid = createGrid(level);
    const field = buildField(grid, new Set(), level.exits[0]);
    for (const t of pathTiles(field, level.starts[0])) out[t.row * COLS + t.col] = 'route';
  }

  for (const t of level.starts) out[t.row * COLS + t.col] = 'spawn';
  for (const t of level.exits) out[t.row * COLS + t.col] = 'exit';
  return out;
}
