import { Container, Graphics } from 'pixi.js';
import { PAL, type Layout } from './chrome.ts';
import { enemyAt, canPlace, towerAt, type RunState } from '../core/state.ts';
import { radiusOf, type Enemy, type EnemyKind } from '../core/enemies.ts';
import { TOWER_STATS, type Tower, type TowerKind } from '../core/towers.ts';
import { pointAlongPath, tileAt, COLS, ROWS, type Grid } from '../core/grid.ts';

/**
 * Draws the board: tiles, towers, enemies, the range ring and the pointer reticle.
 *
 * Tiles and the path centre line are static for a given layout and are only redrawn when the board
 * geometry changes; towers, enemies and overlays are redrawn every frame from the run state.
 */

const TOWER_COLOR: Record<TowerKind, number> = {
  gun: PAL.teal,
  cannon: PAL.maroon,
  taser: PAL.olive,
};

const ENEMY_COLOR: Record<EnemyKind, number> = {
  grunt: PAL.navy,
  runner: PAL.purple,
  shielded: PAL.maroon,
};

export interface BoardHover {
  col: number;
  row: number;
  onBoard: boolean;
}

export class BoardView {
  readonly root = new Container();
  private readonly tiles = new Graphics();
  private readonly entities = new Graphics();
  private readonly overlay = new Graphics();

  private staticX = -1;
  private staticY = -1;
  private staticCell = -1;

  constructor() {
    this.root.addChild(this.tiles, this.entities, this.overlay);
  }

  draw(state: RunState, l: Layout, alpha: number, hover: BoardHover): void {
    const { board } = l;
    const cell = board.cell;

    if (board.x !== this.staticX || board.y !== this.staticY || cell !== this.staticCell) {
      this.staticX = board.x;
      this.staticY = board.y;
      this.staticCell = cell;
      this.drawStatic(state.grid, board, cell);
    }

    this.entities.clear();
    this.overlay.clear();

    for (const t of state.towers) {
      drawTower(this.entities, t, board, cell);
    }

    const hoveredTower = hover.onBoard ? towerAt(state, hover.col, hover.row) : undefined;
    if (hoveredTower) {
      const cx = board.x + (hoveredTower.col + 0.5) * cell;
      const cy = board.y + (hoveredTower.row + 0.5) * cell;
      dashedCircle(this.overlay, cx, cy, TOWER_STATS[hoveredTower.kind].range * cell, PAL.navy, 1);
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      drawEnemy(this.entities, e, state.grid, board, cell, alpha);
    }

    if (state.selected && hover.onBoard && canPlace(state, state.selected, hover.col, hover.row)) {
      const cx = board.x + (hover.col + 0.5) * cell;
      const cy = board.y + (hover.row + 0.5) * cell;
      drawTowerShape(this.overlay, state.selected, cx, cy, cell, 0.5);
      dashedCircle(this.overlay, cx, cy, TOWER_STATS[state.selected].range * cell, PAL.navy, 1);
    }

    if (state.pointer.stage >= 2 && state.phase === 'wave') {
      drawReticle(this.overlay, state, board, cell);
    }
  }

  private drawStatic(grid: Grid, board: { x: number; y: number; cell: number }, cell: number): void {
    const g = this.tiles;
    g.clear();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const kind = tileAt(grid, col, row);
        if (!kind) continue;
        const px = board.x + col * cell;
        const py = board.y + row * cell;
        drawTile(g, kind, px, py, cell);
      }
    }
    drawPath(g, grid, board, cell, board.x + cell * COLS, board.y + cell * ROWS);
  }
}

function drawTile(g: Graphics, kind: 'buildable' | 'path' | 'blocked', px: number, py: number, cell: number): void {
  if (kind === 'buildable') {
    g.rect(px, py, cell, cell).fill(PAL.face);
    hline(g, px, px + cell, py + 0.5, PAL.highlight);
    vline(g, px + 0.5, py, py + cell, PAL.highlight);
    hline(g, px, px + cell, py + cell - 0.5, PAL.shadow);
    vline(g, px + cell - 0.5, py, py + cell, PAL.shadow);
  } else if (kind === 'path') {
    g.rect(px, py, cell, cell).fill(PAL.shadow);
    edgeRect(g, px, py, cell, 0x404040);
  } else {
    g.rect(px, py, cell, cell).fill(0xa0a0a0);
    edgeRect(g, px, py, cell, 0x707070);
  }
}

function hline(g: Graphics, x0: number, x1: number, y: number, color: number): void {
  g.moveTo(x0, y).lineTo(x1, y).stroke({ width: 1, color });
}

function vline(g: Graphics, x: number, y0: number, y1: number, color: number): void {
  g.moveTo(x, y0).lineTo(x, y1).stroke({ width: 1, color });
}

function edgeRect(g: Graphics, x: number, y: number, s: number, color: number): void {
  hline(g, x, x + s, y + 0.5, color);
  hline(g, x, x + s, y + s - 0.5, color);
  vline(g, x + 0.5, y, y + s, color);
  vline(g, x + s - 0.5, y, y + s, color);
}

function drawPath(
  g: Graphics,
  grid: Grid,
  board: { x: number; y: number; cell: number },
  cell: number,
  bx1: number,
  by1: number,
): void {
  const x0 = board.x;
  const y0 = board.y;
  for (let i = 1; i < grid.waypoints.length; i++) {
    const a = grid.waypoints[i - 1];
    const b = grid.waypoints[i];
    const ax = x0 + a.x * cell;
    const ay = y0 + a.y * cell;
    const bx = x0 + b.x * cell;
    const by = y0 + b.y * cell;
    const seg = clipAxisAligned(ax, ay, bx, by, x0, y0, bx1, by1);
    if (!seg) continue;
    dashedLine(g, seg[0], seg[1], seg[2], seg[3], 4, 4, 3, PAL.light);
  }
}

/** Clips an axis-aligned segment to the board rect; returns null when it misses entirely. */
function clipAxisAligned(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number, number] | null {
  if (ax === bx) {
    if (ax < x0 || ax > x1) return null;
    const lo = Math.max(y0, Math.min(ay, by));
    const hi = Math.min(y1, Math.max(ay, by));
    if (lo >= hi) return null;
    return [ax, lo, ax, hi];
  }
  if (ay < y0 || ay > y1) return null;
  const lo = Math.max(x0, Math.min(ax, bx));
  const hi = Math.min(x1, Math.max(ax, bx));
  if (lo >= hi) return null;
  return [lo, ay, hi, ay];
}

function dashedLine(
  g: Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number,
  thick: number,
  color: number,
): void {
  const half = Math.floor(thick / 2);
  if (x0 === x1) {
    const x = Math.round(x0);
    for (let y = y0; y < y1; y += dash + gap) {
      const h = Math.min(dash, y1 - y);
      g.rect(x - half, Math.round(y), thick, h).fill(color);
    }
  } else {
    const y = Math.round(y0);
    for (let x = x0; x < x1; x += dash + gap) {
      const w = Math.min(dash, x1 - x);
      g.rect(Math.round(x), y - half, w, thick).fill(color);
    }
  }
}

function dashedCircle(g: Graphics, cx: number, cy: number, r: number, color: number, width = 1): void {
  const dashDeg = 8;
  const gapDeg = 6;
  for (let a = 0; a < 360; a += dashDeg + gapDeg) {
    const a0 = (a * Math.PI) / 180;
    const a1 = (Math.min(a + dashDeg, 360) * Math.PI) / 180;
    const steps = Math.max(2, Math.ceil(((a1 - a0) * r) / 3));
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      g.moveTo(cx + Math.cos(t0) * r, cy + Math.sin(t0) * r).lineTo(cx + Math.cos(t1) * r, cy + Math.sin(t1) * r);
    }
    g.stroke({ width, color });
  }
}

function drawTower(g: Graphics, t: Tower, board: { x: number; y: number; cell: number }, cell: number): void {
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  drawTowerShape(g, t.kind, cx, cy, cell, 1);
}

function drawTowerShape(g: Graphics, kind: TowerKind, cx: number, cy: number, cell: number, alpha: number): void {
  const color = TOWER_COLOR[kind];
  const fill = { color, alpha };
  const outline = { width: 1, color: PAL.dark, alpha };

  if (kind === 'gun') {
    const s = Math.round(cell * 0.42);
    const bx = Math.round(cx - s / 2);
    const by = Math.round(cy - s / 2);
    g.rect(bx, by, s, s).fill(fill).stroke(outline);
    const bw = Math.round(cell * 0.14);
    const bl = Math.round(cell * 0.32);
    g.rect(Math.round(cx - bw / 2), by - bl, bw, bl).fill(fill).stroke(outline);
  } else if (kind === 'cannon') {
    const r = Math.round(cell * 0.34);
    g.circle(cx, cy, r).fill(fill).stroke(outline);
    const bw = Math.round(cell * 0.2);
    const bl = Math.round(cell * 0.36);
    g.rect(Math.round(cx - bw / 2), Math.round(cy - r - bl), bw, bl).fill(fill).stroke(outline);
  } else {
    const r = Math.round(cell * 0.38);
    g.poly([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy]).fill(fill).stroke(outline);
    const top = cy + r + 2;
    const cw = Math.round(cell * 0.14);
    g.moveTo(cx - cw, top)
      .lineTo(cx + cw, top)
      .lineTo(cx - cw, top + 3)
      .lineTo(cx + cw, top + 6)
      .stroke(outline);
  }
}

function enemyHeading(grid: Grid, e: Enemy): number {
  let dx = e.x - e.prevX;
  let dy = e.y - e.prevY;
  if (dx === 0 && dy === 0) {
    const p0 = pointAlongPath(grid, e.dist);
    const p1 = pointAlongPath(grid, Math.min(e.dist + 0.1, grid.length));
    dx = p1.x - p0.x;
    dy = p1.y - p0.y;
  }
  return Math.atan2(dy, dx);
}

function drawEnemy(
  g: Graphics,
  e: Enemy,
  grid: Grid,
  board: { x: number; y: number; cell: number },
  cell: number,
  alpha: number,
): void {
  const ex = (e.prevX + (e.x - e.prevX) * alpha) * cell + board.x;
  const ey = (e.prevY + (e.y - e.prevY) * alpha) * cell + board.y;
  const r = radiusOf(e) * cell;
  const color = ENEMY_COLOR[e.kind];
  const fill = { color };
  const outline = { width: 1, color: PAL.dark };

  if (e.kind === 'grunt') {
    g.circle(ex, ey, r).fill(fill).stroke(outline);
  } else if (e.kind === 'runner') {
    const heading = enemyHeading(grid, e);
    const tipX = ex + Math.cos(heading) * r * 1.25;
    const tipY = ey + Math.sin(heading) * r * 1.25;
    const a1 = heading + Math.PI * 0.72;
    const a2 = heading - Math.PI * 0.72;
    const p1x = ex + Math.cos(a1) * r;
    const p1y = ey + Math.sin(a1) * r;
    const p2x = ex + Math.cos(a2) * r;
    const p2y = ey + Math.sin(a2) * r;
    g.poly([tipX, tipY, p1x, p1y, p2x, p2y]).fill(fill).stroke(outline);
  } else {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      pts.push(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
    }
    g.poly(pts).fill(fill).stroke(outline);
    if (e.shield > 0) {
      g.circle(ex, ey, r + 3).stroke({ width: 1, color: PAL.teal });
    }
  }

  const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 0;
  if (ratio < 1) {
    const arcR = r + 4;
    const a0 = -Math.PI / 2 - Math.PI * ratio;
    const a1 = -Math.PI / 2 + Math.PI * ratio;
    g.moveTo(ex + Math.cos(a0) * arcR, ey + Math.sin(a0) * arcR)
      .arc(ex, ey, arcR, a0, a1)
      .stroke({
        width: 2,
        color: healthColor(ratio),
      });
  }
}

function healthColor(ratio: number): number {
  const red = Math.round(0xc0 * (1 - ratio));
  const green = Math.round(0xc0 * ratio);
  return (red << 16) | (green << 8);
}

function drawReticle(g: Graphics, state: RunState, board: { x: number; y: number; cell: number }, cell: number): void {
  const p = state.pointer;
  const px = board.x + p.x * cell;
  const py = board.y + p.y * cell;

  g.circle(px, py, 8).stroke({ width: 1, color: PAL.navy });

  const target =
    state.enemies.find((e) => e.id === p.targetId && !e.dead) ?? enemyAt(state, p.x, p.y);
  if (!target) return;

  const ex = board.x + target.x * cell;
  const ey = board.y + target.y * cell;
  const rr = radiusOf(target) * cell + 6;
  const tick = 6;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-rr, -rr],
    [rr, -rr],
    [rr, rr],
    [-rr, rr],
  ];
  for (const [dx, dy] of corners) {
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    g.moveTo(ex + dx, ey + dy).lineTo(ex + dx, ey + dy - sy * tick);
    g.moveTo(ex + dx, ey + dy).lineTo(ex + dx - sx * tick, ey + dy);
  }
  g.stroke({ width: 1, color: PAL.navy });
}
