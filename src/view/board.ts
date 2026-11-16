import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, PAL, type Layout } from './chrome.ts';
import {
  enemyAt,
  canPlace,
  towerAt,
  currentPath,
  selectedTower,
  towerRangeMult,
  type RunState,
} from '../core/state.ts';
import { radiusOf, type Enemy, type EnemyKind } from '../core/enemies.ts';
import { effectiveStats, TOWER_STATS, type Tower, type TowerKind } from '../core/towers.ts';
import { tileAt, COLS, ROWS, type Grid } from '../core/grid.ts';

/**
 * Draws the board: tiles, the live route, towers, enemies, the range ring and the pointer reticle.
 *
 * Tiles are static for a given layout and are only redrawn when the board geometry changes. The
 * route is redrawn whenever the player's maze changes it; towers, enemies and overlays are redrawn
 * every frame from the run state.
 */

export const TOWER_COLOR: Record<TowerKind, number> = {
  gun: PAL.teal,
  cannon: PAL.maroon,
  taser: PAL.olive,
  frost: 0x3399cc,
  laser: 0xff3300,
  beacon: 0xffcc00,
  wall: 0x8a8a8a,
};

export const ENEMY_COLOR: Record<EnemyKind, number> = {
  grunt: PAL.navy,
  runner: PAL.purple,
  shielded: PAL.maroon,
  flyer: 0x8000ff,
  armoured: 0x406080,
  saboteur: 0x808000,
  boss: 0x806000,
  breacher: 0xa04040,
};

const AURA_COLOR = 0x6699ff;
const SLOW_COLOR = 0x00d0ff;

export interface BoardHover {
  col: number;
  row: number;
  onBoard: boolean;
}

export class BoardView {
  readonly root = new Container();
  private readonly tiles = new Graphics();
  private readonly path = new Graphics();
  private readonly entities = new Graphics();
  private readonly overlay = new Graphics();
  private readonly note = new Text({
    text: 'Build a maze. Towers block the route.',
    style: { fontFamily: FONT, fontSize: 11, fill: PAL.text },
  });

  private staticX = -1;
  private staticY = -1;
  private staticCell = -1;
  private pathKey = '';

  constructor() {
    this.note.anchor.set(0, 0.5);
    this.root.addChild(this.tiles, this.path, this.entities, this.overlay, this.note);
  }

  draw(state: RunState, l: Layout, alpha: number, hover: BoardHover): void {
    const { board } = l;
    const cell = board.cell;

    if (board.x !== this.staticX || board.y !== this.staticY || cell !== this.staticCell) {
      this.staticX = board.x;
      this.staticY = board.y;
      this.staticCell = cell;
      this.pathKey = '';
      this.drawStatic(state.grid, board, cell);
    }

    this.drawRoute(state, board, cell);

    this.entities.clear();
    this.overlay.clear();

    for (const t of state.towers) {
      drawTower(this.entities, t, board, cell);
    }

    const rangeMult = towerRangeMult(state);
    const hoveredTower = hover.onBoard ? towerAt(state, hover.col, hover.row) : undefined;
    if (hoveredTower) drawTowerRange(this.overlay, hoveredTower, board, cell, rangeMult);

    const inspected = selectedTower(state);
    if (inspected) {
      if (inspected !== hoveredTower) drawTowerRange(this.overlay, inspected, board, cell, rangeMult);
      const sx = board.x + inspected.col * cell + 0.5;
      const sy = board.y + inspected.row * cell + 0.5;
      this.overlay
        .rect(sx, sy, cell - 1, cell - 1)
        .stroke({ width: 1, color: PAL.title });
    }

    for (const e of state.enemies) {
      if (e.dead) continue;
      drawEnemy(this.entities, e, board, cell, alpha, state.tick < e.slowUntilTick);
    }

    if (state.selected && hover.onBoard && canPlace(state, state.selected, hover.col, hover.row)) {
      const cx = board.x + (hover.col + 0.5) * cell;
      const cy = board.y + (hover.row + 0.5) * cell;
      drawTowerShape(this.overlay, state.selected, cx, cy, cell, 0.5);
      dashedCircle(this.overlay, cx, cy, TOWER_STATS[state.selected].range * cell, PAL.navy, 1);
    }

    if (state.modifiers.includes('no-build') && state.phase === 'wave' && state.noBuildRow !== null) {
      drawNoBuildRow(this.overlay, state.noBuildRow, board, cell);
    }

    if (state.pointer.stage >= 2 && state.phase === 'wave') {
      drawReticle(this.overlay, state, board, cell);
    }

    if (state.onboarding && !state.placedFirstTower) {
      this.drawFirstRunNote(l);
      this.note.visible = true;
    } else {
      this.note.visible = false;
    }
  }

  private drawFirstRunNote(l: Layout): void {
    const w = 190;
    const h = 26;
    const gap = 6;
    const rect = {
      x: l.board.x + Math.floor((l.boardW - w) / 2),
      y: l.board.y - h - gap,
      w,
      h,
    };
    bevel(this.overlay, rect, false, PAL.face);
    this.note.position.set(rect.x + 6, rect.y + Math.floor(rect.h / 2));
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
  }

  private drawRoute(state: RunState, board: { x: number; y: number; cell: number }, cell: number): void {
    const route = currentPath(state);
    const key = route.map((t) => `${t.col},${t.row}`).join('|');
    if (key === this.pathKey) return;
    this.pathKey = key;

    const g = this.path;
    g.clear();
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1];
      const b = route[i];
      const ax = board.x + (a.col + 0.5) * cell;
      const ay = board.y + (a.row + 0.5) * cell;
      const bx = board.x + (b.col + 0.5) * cell;
      const by = board.y + (b.row + 0.5) * cell;
      dashedLine(g, ax, ay, bx, by, 4, 4, 3, PAL.light);
    }
  }
}

function drawTile(g: Graphics, kind: 'buildable' | 'blocked', px: number, py: number, cell: number): void {
  if (kind === 'buildable') {
    g.rect(px, py, cell, cell).fill(PAL.face);
    hline(g, px, px + cell, py + 0.5, PAL.highlight);
    vline(g, px + 0.5, py, py + cell, PAL.highlight);
    hline(g, px, px + cell, py + cell - 0.5, PAL.shadow);
    vline(g, px + cell - 0.5, py, py + cell, PAL.shadow);
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

function drawNoBuildRow(
  g: Graphics,
  row: number,
  board: { x: number; y: number; cell: number },
  cell: number,
): void {
  const y0 = board.y + row * cell;
  const y1 = y0 + cell;
  g.rect(board.x, y0, COLS * cell, cell).fill({ color: PAL.dark, alpha: 0.18 });
  for (let x = board.x; x < board.x + COLS * cell; x += cell * 0.6) {
    g.moveTo(x, y1).lineTo(x + cell * 0.6, y0).stroke({ width: 1, color: PAL.dark });
  }
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
  drawTowerShape(g, t.kind, cx, cy, cell, 1, t.angle);

  // A damaged wall shows a health bar above it; an undamaged wall shows nothing.
  if (t.kind === 'wall' && t.maxHp > 0 && t.hp < t.maxHp) {
    const ratio = t.maxHp > 0 ? t.hp / t.maxHp : 0;
    const w = Math.round(cell * 0.8);
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - cell * 0.5 - 6);
    g.rect(x0, y0, w, 3).fill({ color: PAL.dark });
    g.rect(x0 + 1, y0 + 1, Math.max(0, Math.round((w - 2) * ratio)), 1).fill({ color: healthColor(ratio) });
  }
}

function drawTowerRange(
  g: Graphics,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
  rangeMult: number,
): void {
  const st = effectiveStats(t);
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  dashedCircle(g, cx, cy, (st.range + t.auraRange) * rangeMult * cell, PAL.navy, 1);
  if (t.kind === 'beacon') dashedCircle(g, cx, cy, st.range * rangeMult * cell, AURA_COLOR, 1);
}

interface BarrelFill {
  color: number;
  alpha: number;
}

/**
 * Draw a barrel rectangle centred on the tower and rotate it by `angle` (radians, 0 = north,
 * clockwise). At angle 0 the barrel is drawn with the exact rounded pixel-grid rect, so the
 * north-facing tower looks identical to the pre-traverse build; at any other angle it becomes a
 * smoothly rotated polygon around the tower centre.
 */
function drawBarrel(
  g: Graphics,
  cx: number,
  cy: number,
  angle: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: BarrelFill,
  outline: BarrelFill,
): void {
  if (angle === 0) {
    g.rect(x, y, w, h).fill(fill).stroke(outline);
    return;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pts: number[] = [];
  for (const [lx, ly] of [
    [x - cx, y - cy],
    [x + w - cx, y - cy],
    [x + w - cx, y + h - cy],
    [x - cx, y + h - cy],
  ]) {
    pts.push(cx + lx * cos - ly * sin, cy + lx * sin + ly * cos);
  }
  g.poly(pts).fill(fill).stroke(outline);
}

function drawTowerShape(
  g: Graphics,
  kind: TowerKind,
  cx: number,
  cy: number,
  cell: number,
  alpha: number,
  angle = 0,
): void {
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
    drawBarrel(g, cx, cy, angle, Math.round(cx - bw / 2), by - bl, bw, bl, fill, outline);
  } else if (kind === 'cannon') {
    const r = Math.round(cell * 0.34);
    g.circle(cx, cy, r).fill(fill).stroke(outline);
    const bw = Math.round(cell * 0.2);
    const bl = Math.round(cell * 0.36);
    drawBarrel(g, cx, cy, angle, Math.round(cx - bw / 2), Math.round(cy - r - bl), bw, bl, fill, outline);
  } else if (kind === 'wall') {
    const s = Math.round(cell * 0.78);
    const bx = Math.round(cx - s / 2);
    const by = Math.round(cy - s / 2);
    g.rect(bx, by, s, s).fill(fill).stroke({ width: 1, color: PAL.dark, alpha });
    // Brick joints: a course line plus staggered perpends.
    g.moveTo(bx, by + Math.round(s / 2)).lineTo(bx + s, by + Math.round(s / 2))
      .stroke({ width: 1, color: PAL.shadow, alpha });
    g.moveTo(bx + Math.round(s / 2), by).lineTo(bx + Math.round(s / 2), by + Math.round(s / 2))
      .stroke({ width: 1, color: PAL.shadow, alpha });
    g.moveTo(bx + Math.round(s / 4), by + Math.round(s / 2)).lineTo(bx + Math.round(s / 4), by + s)
      .stroke({ width: 1, color: PAL.shadow, alpha });
    g.moveTo(bx + Math.round((3 * s) / 4), by + Math.round(s / 2)).lineTo(bx + Math.round((3 * s) / 4), by + s)
      .stroke({ width: 1, color: PAL.shadow, alpha });
  } else {
    const r = Math.round(cell * 0.38);
    g.poly([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy]).fill(fill).stroke(outline);
    if (kind === 'laser') {
      const bw = Math.max(2, Math.min(3, Math.round(cell * 0.08)));
      const bl = Math.round(cell * 0.34);
      drawBarrel(g, cx, cy, angle, Math.round(cx - bw / 2), Math.round(cy - bl), bw, bl, fill, outline);
    }
    const top = cy + r + 2;
    const cw = Math.round(cell * 0.14);
    g.moveTo(cx - cw, top)
      .lineTo(cx + cw, top)
      .lineTo(cx - cw, top + 3)
      .lineTo(cx + cw, top + 6)
      .stroke(outline);
  }
}

/**
 * The enemy's body shape, shared by the live draw and the death collapse. `r` is the radius in
 * pixels; `alpha` lets the death animation fade the shape as it shrinks toward a point.
 */
export function drawEnemyShape(
  g: Graphics,
  kind: EnemyKind,
  x: number,
  y: number,
  r: number,
  color: number,
  heading: number,
  alpha = 1,
): void {
  const fill = { color, alpha };
  const outline = { width: 1, color: PAL.dark, alpha };
  const hex = (radius: number): number[] => {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      pts.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    return pts;
  };

  if (kind === 'grunt') {
    g.circle(x, y, r).fill(fill).stroke(outline);
  } else if (kind === 'runner') {
    const tipX = x + Math.cos(heading) * r * 1.25;
    const tipY = y + Math.sin(heading) * r * 1.25;
    const a1 = heading + Math.PI * 0.72;
    const a2 = heading - Math.PI * 0.72;
    const p1x = x + Math.cos(a1) * r;
    const p1y = y + Math.sin(a1) * r;
    const p2x = x + Math.cos(a2) * r;
    const p2y = y + Math.sin(a2) * r;
    g.poly([tipX, tipY, p1x, p1y, p2x, p2y]).fill(fill).stroke(outline);
  } else if (kind === 'flyer') {
    const tipX = x + Math.cos(heading) * r;
    const tipY = y + Math.sin(heading) * r;
    const bx = x - Math.cos(heading) * r * 0.6;
    const by = y - Math.sin(heading) * r * 0.6;
    const px = -Math.sin(heading) * r;
    const py = Math.cos(heading) * r;
    g.moveTo(bx + px, by + py).lineTo(tipX, tipY);
    g.moveTo(bx - px, by - py).lineTo(tipX, tipY);
    g.stroke({ width: 2, color, alpha });
  } else if (kind === 'armoured') {
    const s = r * 1.6;
    g.rect(x - s / 2, y - s / 2, s, s).fill(fill).stroke({ width: 3, color: PAL.dark, alpha });
  } else if (kind === 'saboteur') {
    g.circle(x, y, r).fill(fill).stroke(outline);
  } else if (kind === 'boss') {
    g.poly(hex(r)).fill(fill).stroke({ width: 2, color: PAL.dark, alpha });
    g.circle(x, y, r * 1.1).stroke({ width: 1, color: PAL.dark, alpha });
    g.circle(x, y, r * 1.18).stroke({ width: 1, color: PAL.dark, alpha });
  } else if (kind === 'breacher') {
    const s = r * 1.6;
    g.rect(x - s / 2, y - s / 2, s, s).fill(fill).stroke({ width: 3, color: PAL.dark, alpha });
    // The battering ram: a short bar jutting from the leading edge.
    const bx = x + Math.cos(heading) * s * 0.5;
    const by = y + Math.sin(heading) * s * 0.5;
    const rx = x + Math.cos(heading) * (s * 0.5 + r * 0.8);
    const ry = y + Math.sin(heading) * (s * 0.5 + r * 0.8);
    g.moveTo(bx, by).lineTo(rx, ry).stroke({ width: 3, color: PAL.dark, alpha });
  } else {
    g.poly(hex(r)).fill(fill).stroke(outline);
  }
}

function drawEnemy(
  g: Graphics,
  e: Enemy,
  board: { x: number; y: number; cell: number },
  cell: number,
  alpha: number,
  slowed: boolean,
): void {
  const ex = (e.prevX + (e.x - e.prevX) * alpha) * cell + board.x;
  const ey = (e.prevY + (e.y - e.prevY) * alpha) * cell + board.y;
  const r = radiusOf(e) * cell;
  const color = ENEMY_COLOR[e.kind];

  drawEnemyShape(g, e.kind, ex, ey, r, color, e.heading);

  if (e.kind === 'saboteur') {
    const sy = ey - r - 2;
    g.moveTo(ex - r * 0.4, sy).lineTo(ex + r * 0.1, sy + r * 0.7).lineTo(ex - r * 0.1, sy + r * 0.7).lineTo(ex + r * 0.4, sy + r * 1.4).stroke({ width: 1, color: PAL.amber });
  }
  if (e.shield > 0 && (e.kind === 'boss' || e.kind === 'shielded')) {
    g.circle(ex, ey, r + (e.kind === 'boss' ? 7 : 3)).stroke({ width: 1, color: PAL.teal });
  }

  // Weak-point notch: a short tick on the leading edge where a precision click pays double.
  {
    const n0 = r * 0.7;
    const n1 = r * 1.08;
    const nh = e.heading;
    g.moveTo(ex + Math.cos(nh) * n0, ey + Math.sin(nh) * n0)
      .lineTo(ex + Math.cos(nh) * n1, ey + Math.sin(nh) * n1)
      .stroke({ width: 2, color: PAL.highlight });
  }

  if (slowed) {
    const sr = r + 2.5;
    const a0 = Math.PI * 0.2;
    const a1 = Math.PI * 0.8;
    g.moveTo(ex + Math.cos(a0) * sr, ey + Math.sin(a0) * sr)
      .arc(ex, ey, sr, a0, a1)
      .stroke({ width: 1, color: SLOW_COLOR });
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
