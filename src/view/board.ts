import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { artNameForBranch, artNameForEnemy, artNameForTowerBase, artNameForTowerTurret, artSpriteSize, getArtTexture } from './art.ts';
import { bevel, FONT, FONT_SIZE, PAL, type BoardGeometry, type Layout } from './chrome.ts';
import {
  enemyAt,
  canPlace,
  towerAt,
  currentPath,
  selectedTower,
  towerRangeMult,
  type RunState,
} from '../core/state.ts';
import {
  baseEnemyKind,
  isBossKind,
  isBossVariant,
  PACER_AURA_RADIUS,
  radiusOf,
  type Enemy,
  type EnemyKind,
} from '../core/enemies.ts';
import { cursorRadius, effectiveStats, isFullyUpgraded, isGateLocked, isOffline, isRepairing, repairProgress, repairRadius, TOWER_STATS, type Branch, type Tower, type TowerKind } from '../core/towers.ts';
import { tileAt, COLS, ROWS, type Grid, type Tile } from '../core/grid.ts';
import { toggleOpenAt, toggleProgress, type LevelToggle } from '../core/levels.ts';
import { dashRects, offsetSegment, routeOffset, type RouteSegment } from './route.ts';
import {
  hatchSegments,
  lerpColor,
  RAISED_BR,
  RAISED_TL,
  wallFocusRect,
  wallFootprintSize,
  wallSpec,
  WALL_OUTLINE,
  type WallSpec,
  type WallState,
} from './wallAppearance.ts';
import {
  branchMarkSpec,
  healthBarRect,
  PIP_FILL,
  PIP_HIGHLIGHT,
  pipRect,
  pipUsesBottomCorner,
  type MarkPrimitive,
  type Rect,
} from './branchMarks.ts';
import {
  enemyDrawOrder,
  popupCloseHit,
  popupCloseRect,
  popupTitleH,
  popupWindowRect,
} from './popupEnemy.ts';

export { dashRects, offsetSegment, routeOffset } from './route.ts';

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
  repair: 0x00a000,
  wall: 0x8a8a8a,
  cursor: 0x9a9a9a,
};

/**
 * Identity of the static tile layer: the authored level, the grid size and the board geometry.
 * The layer is redrawn only when this key changes, so a map cycle rebuilds the walls while a
 * resize-free frame leaves them alone.
 */
export function staticLayerKey(
  state: Pick<RunState, 'levelId' | 'grid'>,
  board: BoardGeometry,
): string {
  return `${state.levelId}|${state.grid.cols}x${state.grid.rows}|${board.x},${board.y},${board.cell}`;
}

/**
 * Enemy bodies live in one grey/blue family: shape and outline carry identity, colour only shades
 * it. Each value is a slightly different blue-grey so a mixed wave reads as one coherent force, not
 * a rainbow of blobs.
 */
export const ENEMY_COLOR: Record<EnemyKind, number> = {
  grunt: 0x35506a,
  runner: 0x577489,
  shielded: 0x2f4b62,
  flyer: 0x6b8598,
  armoured: 0x406080,
  saboteur: 0x4a637a,
  boss: 0x27495d,
  breacher: 0x5a7183,
  popup: 0x000080,
  'grunt-boss': 0x35506a,
  'runner-boss': 0x577489,
  'shielded-boss': 0x2f4b62,
};

/** The single cyan for shield visuals: the shield ring, the impact arc and the `SHD` floater. */
export const SHIELD_COLOR = 0x00d0d0;

/**
 * The SVG silhouette's on-screen bounding diameter, in units of the enemy's pixel radius `r`. The
 * art is authored to fill the 32x32 viewBox's 28px silhouette, and the sprite is sized so that
 * silhouette spans `factor × r` pixels — the same box the procedural body occupied.
 */
export const ENEMY_ART_BODY: Record<EnemyKind, number> = {
  grunt: 2.0,
  runner: 2.2,
  shielded: 2.7,
  flyer: 2.6,
  armoured: 1.6,
  saboteur: 2.4,
  boss: 2.6,
  breacher: 2.2,
  popup: 2.0,
  'grunt-boss': 2.0,
  'runner-boss': 2.2,
  'shielded-boss': 2.7,
};

/** Kinds whose silhouette is oriented: they rotate with the enemy's heading. The rest are symmetric. */
export const ENEMY_ART_ROTATES: ReadonlySet<EnemyKind> = new Set(['runner', 'flyer', 'saboteur', 'breacher', 'runner-boss']);

const AURA_COLOR = 0x6699ff;
const SLOW_COLOR = 0x00d0ff;

export interface BoardHover {
  col: number;
  row: number;
  onBoard: boolean;
  x: number;
  y: number;
}

export class BoardView {
  readonly root = new Container();
  private readonly tiles = new Graphics();
  private readonly path = new Graphics();
  private readonly toggles = new Graphics();
  private readonly towers = new Graphics();
  private readonly towerSprites = new Container();
  private readonly towerBaseSprites: Sprite[] = [];
  private readonly towerTurretSprites: Sprite[] = [];
  private readonly towerMarkSprites: Sprite[] = [];
  private readonly popups = new Container();
  private readonly popupGfx = new Graphics();
  private readonly tileSprites = new Container();
  private readonly enemies = new Container();
  private readonly enemyBodies = new Graphics();
  private readonly enemyFx = new Graphics();
  private readonly enemySprites: Sprite[] = [];
  private readonly overlay = new Graphics();
  private readonly note = new Text({
    text: 'Build a maze. Towers block the route.',
    style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text },
  });
  private readonly popupTexts: { title: Text; message: Text }[] = [];

  private staticKey = '';
  private pathKey = '';

  constructor() {
    this.note.anchor.set(0, 0.5);
    this.popups.addChild(this.popupGfx);
    this.root.addChild(this.tileSprites, this.tiles, this.path, this.toggles, this.towerSprites, this.towers, this.popups, this.enemies, this.enemyBodies, this.enemyFx, this.overlay, this.note);
  }

  /** The pooled body sprite for the `index`-th living enemy, grown on demand. */
  private enemySprite(index: number): Sprite {
    let s = this.enemySprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.enemySprites.push(s);
      this.enemies.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled plinth sprite for the `index`-th tower, grown on demand. */
  private towerBaseSprite(index: number): Sprite {
    let s = this.towerBaseSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.towerBaseSprites.push(s);
      this.towerSprites.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled barrel sprite for the `index`-th tower, grown on demand. */
  private towerTurretSprite(index: number): Sprite {
    let s = this.towerTurretSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.towerTurretSprites.push(s);
      this.towerSprites.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled branch-mark sprite for the `index`-th tower, grown on demand. */
  private towerMarkSprite(index: number): Sprite {
    let s = this.towerMarkSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.towerMarkSprites.push(s);
      this.towerSprites.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The caption and message Text objects for the `i`-th live pop-up, creating them on demand. */
  private popupText(i: number): { title: Text; message: Text } {
    while (this.popupTexts.length <= i) {
      const title = new Text({
        text: '',
        style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fontWeight: 'bold', fill: PAL.titleInverse },
      });
      title.anchor.set(0, 0.5);
      const message = new Text({
        text: '',
        style: { fontFamily: FONT, fontSize: FONT_SIZE.board, fill: PAL.text, wordWrap: true },
      });
      message.anchor.set(0, 0.5);
      this.popupTexts.push({ title, message });
      this.popups.addChild(title, message);
    }
    return this.popupTexts[i];
  }

  draw(
    state: RunState,
    l: Layout,
    alpha: number,
    hover: BoardHover,
    knockbackFor?: (id: number, tick: number) => { dx: number; dy: number } | null,
  ): void {
    const { board } = l;
    const cell = board.cell;

    const layerKey = staticLayerKey(state, board);
    if (layerKey !== this.staticKey) {
      this.staticKey = layerKey;
      this.pathKey = '';
      this.drawStatic(state.grid, board, cell);
    }

    this.drawRoute([currentPath(state)], board, cell);

    this.towers.clear();
    this.enemyBodies.clear();
    this.enemyFx.clear();
    this.popupGfx.clear();
    this.overlay.clear();

    this.toggles.clear();
    for (const tg of state.toggles) {
      drawShutter(this.toggles, tg, board, cell, state.clock);
    }

    let towerIndex = 0;
    for (const t of state.towers) {
      drawTower(this.towerBaseSprite(towerIndex), this.towerTurretSprite(towerIndex), this.towerMarkSprite(towerIndex), this.towers, t, board, cell, state.clock);
      towerIndex++;
    }
    for (let i = towerIndex; i < this.towerBaseSprites.length; i++) this.towerBaseSprites[i].visible = false;
    for (let i = towerIndex; i < this.towerTurretSprites.length; i++) this.towerTurretSprites[i].visible = false;
    for (let i = towerIndex; i < this.towerMarkSprites.length; i++) this.towerMarkSprites[i].visible = false;

    const rangeMult = towerRangeMult(state);
    const hoveredTower = hover.onBoard ? towerAt(state, hover.col, hover.row) : undefined;
    if (hoveredTower) drawTowerRange(this.overlay, hoveredTower, board, cell, rangeMult);

    const inspected = selectedTower(state);
    if (inspected) {
      if (inspected !== hoveredTower) drawTowerRange(this.overlay, inspected, board, cell, rangeMult);
      const sx = board.x + inspected.col * cell + 0.5;
      const sy = board.y + inspected.row * cell + 0.5;
      if (inspected.kind === 'wall') {
        const cx = board.x + (inspected.col + 0.5) * cell;
        const cy = board.y + (inspected.row + 0.5) * cell;
        drawWallFocus(this.overlay, cx, cy, cell);
      } else {
        this.overlay
          .rect(sx, sy, cell - 1, cell - 1)
          .stroke({ width: 1, color: PAL.title });
      }
    }

    // Pop-up windows draw beneath every other enemy (the shield is blind to towers, not the player).
    const layers = enemyDrawOrder(state.enemies);
    const overClose = (e: Enemy): boolean => hover.onBoard && popupCloseHit(e, board, hover.x, hover.y);
    let pi = 0;
    for (const e of layers.popups) {
      if (e.dead) continue;
      const { title, message } = this.popupText(pi);
      drawPopupWindow(this.popupGfx, e, board, overClose(e));
      const r = popupWindowRect(e, board);
      const titleH = popupTitleH(r);
      title.text = 'Pop-up';
      title.position.set(r.x + 5, r.y + 2 + Math.floor(titleH / 2));
      message.text = 'This program has performed an illegal operation';
      message.style.wordWrapWidth = Math.max(20, r.w - 8);
      const bodyTop = r.y + 2 + titleH;
      message.position.set(r.x + 4, bodyTop + Math.floor((r.h - titleH - 4) / 2));
      pi++;
    }
    for (; pi < this.popupTexts.length; pi++) {
      this.popupTexts[pi].title.text = '';
      this.popupTexts[pi].message.text = '';
    }

    let spriteIndex = 0;
    for (const e of layers.others) {
      if (e.dead) continue;
      const kb = knockbackFor ? knockbackFor(e.id, state.tick) : null;
      drawEnemy(this.enemySprite(spriteIndex), this.enemyBodies, this.enemyFx, e, board, cell, alpha, state.tick < e.slowUntilTick, kb);
      spriteIndex++;
    }
    for (let i = spriteIndex; i < this.enemySprites.length; i++) {
      this.enemySprites[i].visible = false;
    }

    // The flying cursor arrows live above the enemy layer so they are always visible.
    for (const t of state.towers) {
      if (t.kind === 'cursor') drawFlyingCursor(this.overlay, t, board);
    }

    if (state.selected && hover.onBoard && canPlace(state, state.selected, hover.col, hover.row)) {
      const cx = board.x + (hover.col + 0.5) * cell;
      const cy = board.y + (hover.row + 0.5) * cell;
      if (state.selected === 'wall') {
        drawWallShape(this.overlay, { branch: null, open: false, hp: 1, maxHp: 1, locked: false }, cx, cy, cell, 0.5);
      } else {
        drawTowerShape(this.overlay, state.selected, cx, cy, cell, 0.5);
      }
      dashedCircle(this.overlay, cx, cy, TOWER_STATS[state.selected].range * cell, PAL.navy, 1);
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
    const w = 232;
    const h = 30;
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
    this.tileSprites.removeChildren();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const kind = tileAt(grid, col, row);
        if (!kind) continue;
        const px = board.x + col * cell;
        const py = board.y + row * cell;
        const name = kind === 'buildable' ? 'tile' : 'obstacle';
        const tex = getArtTexture(name, cell);
        if (tex !== null) {
          const s = new Sprite(tex);
          s.anchor.set(0.5, 0.5);
          s.position.set(px + cell / 2, py + cell / 2);
          s.width = cell;
          s.height = cell;
          this.tileSprites.addChild(s);
        } else {
          drawTile(g, kind, px, py, cell);
        }
      }
    }
  }

  private drawRoute(
    routes: readonly (readonly Tile[])[],
    board: { x: number; y: number; cell: number },
    cell: number,
  ): void {
    const key = routes
      .map((route, i) => `${routes.length}:${i}:${route.map((t) => `${t.col},${t.row}`).join('|')}`)
      .join(';');
    if (key === this.pathKey) return;
    this.pathKey = key;

    const g = this.path;
    g.clear();
    routes.forEach((route, routeIndex) => {
      const offset = routeOffset(routeIndex, routes.length, cell);
      const segments: RouteSegment[] = [];
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1];
        const b = route[i];
        const ax = board.x + (a.col + 0.5) * cell;
        const ay = board.y + (a.row + 0.5) * cell;
        const bx = board.x + (b.col + 0.5) * cell;
        const by = board.y + (b.row + 0.5) * cell;
        const segment = offsetSegment(ax, ay, bx, by, offset);
        segments.push(segment);
        dashedLine(g, segment.a.x, segment.a.y, segment.b.x, segment.b.y, 4, 4, 3, PAL.light);
      }

      for (let i = 1; i < segments.length; i++) {
        const from = segments[i - 1].b;
        const to = segments[i].a;
        if (from.x === to.x && from.y === to.y) continue;
        g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 3, color: PAL.light });
      }
    });
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

/** Warm colour a shutter's outline drifts toward as it is about to close. */
const SHUTTER_WARM = 0xff6a00;
const SHUTTER_EDGE = 0x707070;

/** Draw one map toggle: a solid shutter when closed, a faint outline plus countdown bar when open. */
function drawShutter(
  g: Graphics,
  tg: LevelToggle,
  board: { x: number; y: number; cell: number },
  cell: number,
  clock: number,
): void {
  const px = board.x + tg.col * cell;
  const py = board.y + tg.row * cell;
  const open = toggleOpenAt(tg, clock);
  const cycles = tg.openTicks > 0 && tg.openTicks < tg.periodTicks;
  const progress = cycles ? toggleProgress(tg, clock) : 0;

  if (open) {
    // The shutter edge stays as a faint outline so the player can read where it will close, warming
    // as the close approaches.
    const color = cycles ? lerpColor(SHUTTER_EDGE, SHUTTER_WARM, progress) : SHUTTER_EDGE;
    g.rect(px + 0.5, py + 0.5, cell - 1, cell - 1).stroke({ width: 1, color, alpha: 0.6 });
  } else {
    g.rect(px, py, cell, cell).fill(0xa0a0a0);
    edgeRect(g, px, py, cell, 0x707070);
  }

  if (cycles) {
    // The countdown bar fills as the next state change approaches; different periods read as
    // different bar speeds.
    const w = Math.round(cell * progress);
    g.rect(px, py, Math.max(0, w), 3).fill({ color: SHUTTER_WARM });
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

export function dashedLine(
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
  for (const r of dashRects(x0, y0, x1, y1, dash, gap, thick)) {
    g.rect(r.x, r.y, r.w, r.h).fill(color);
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

function drawTower(
  baseSprite: Sprite,
  turretSprite: Sprite,
  markSprite: Sprite,
  g: Graphics,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
  clock: number,
): void {
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  if (t.kind === 'wall') {
    const repairing = isRepairing(t, clock);
    drawWallTower(baseSprite, g, { ...t, locked: isGateLocked(t, clock), repairing }, cx, cy, cell);
    if (repairing) {
      // A repair replaces the health bar with a progress bar: how far the job has to run.
      drawBar(g, cx, cy, cell, repairProgress(t, clock), REPAIR_COLOR);
    } else if (t.maxHp > 0 && t.hp < t.maxHp) {
      drawBar(g, cx, cy, cell, t.hp / t.maxHp, healthColor(t.hp / t.maxHp));
    }
  } else {
    drawTowerBody(baseSprite, turretSprite, markSprite, g, t, cx, cy, cell);
    if (isRepairing(t, clock)) {
      drawBar(g, cx, cy, cell, repairProgress(t, clock), REPAIR_COLOR);
    } else if (isOffline(t)) {
      // Broken-but-fixable, not gone: an empty health bar, a desaturating wash, and a red tag.
      drawBar(g, cx, cy, cell, 0, healthColor(0));
      drawOfflineTag(g, cx, cy, cell);
    } else if (t.maxHp > 0 && t.hp < t.maxHp) {
      drawBar(g, cx, cy, cell, t.hp / t.maxHp, healthColor(t.hp / t.maxHp));
    }
  }

  if (isFullyUpgraded(t)) {
    const r = pipRect(cx, cy, cell, pipUsesBottomCorner(t, clock));
    drawPip(g, r);
  }
}

/** Draw a non-wall tower as a base sprite plus a rotating turret sprite, or the procedural fallback. */
function drawTowerBody(
  baseSprite: Sprite,
  turretSprite: Sprite,
  markSprite: Sprite,
  g: Graphics,
  t: Tower,
  cx: number,
  cy: number,
  cell: number,
): void {
  const baseTex = getArtTexture(artNameForTowerBase(t.kind), cell);
  if (baseTex !== null) {
    baseSprite.texture = baseTex;
    baseSprite.visible = true;
    baseSprite.position.set(cx, cy);
    baseSprite.width = cell;
    baseSprite.height = cell;
    baseSprite.tint = 0xffffff;
    baseSprite.rotation = 0;
    baseSprite.alpha = 1;
  } else {
    baseSprite.visible = false;
  }

  const turretName = artNameForTowerTurret(t.kind);
  const turretTex = turretName !== null ? getArtTexture(turretName, cell) : null;
  if (turretTex !== null) {
    turretSprite.texture = turretTex;
    turretSprite.visible = true;
    turretSprite.position.set(cx, cy);
    turretSprite.width = cell;
    turretSprite.height = cell;
    turretSprite.tint = 0xffffff;
    turretSprite.rotation = t.angle;
    turretSprite.alpha = 1;
  } else {
    turretSprite.visible = false;
  }

  if (baseTex === null) {
    // Procedural fallback for a half-finished art pass (deleted once parity is confirmed).
    markSprite.visible = false;
    drawTowerShape(g, t.kind, cx, cy, cell, 1, t.angle, t.branch);
    return;
  }

  // The branch mark: an SVG sprite authored in the tower's own colour at the mark's cell-fraction
  // position, sitting on top of the base and turret. A missing mark leaves no sprite.
  const markName = artNameForBranch(t.kind, t.branch);
  const markTex = markName !== null ? getArtTexture(markName, cell) : null;
  if (markTex !== null) {
    markSprite.texture = markTex;
    markSprite.visible = true;
    markSprite.position.set(cx, cy);
    markSprite.width = cell;
    markSprite.height = cell;
    markSprite.tint = 0xffffff;
    markSprite.rotation = 0;
    markSprite.alpha = 1;
  } else {
    markSprite.visible = false;
    // Fall back to the procedural mark (deleted once parity is confirmed) only when the base is
    // missing too, which is the half-finished-art case; a live tower always has its base.
    drawBranchMark(g, t.kind, t.branch, cx, cy, cell, { color: TOWER_COLOR[t.kind], alpha: 1 }, { width: 1, color: PAL.dark, alpha: 1 });
  }
}

/** Draw a wall as a tinted face sprite plus the procedural button bevel and branch marks. */
function drawWallTower(
  baseSprite: Sprite,
  g: Graphics,
  wall: WallState,
  cx: number,
  cy: number,
  cell: number,
): void {
  const spec = wallSpec(wall);
  const size = wallFootprintSize(cell);
  const faceTex = getArtTexture('wall-base', size);
  if (faceTex !== null) {
    // The face is a white button template; the Win95 grey is applied per state (a button's bevel and
    // its raised/disabled/pressed shade are runtime chrome).
    baseSprite.texture = faceTex;
    baseSprite.visible = true;
    baseSprite.position.set(cx, cy);
    baseSprite.width = size;
    baseSprite.height = size;
    baseSprite.tint = spec.face;
    baseSprite.rotation = 0;
    baseSprite.alpha = 1;
    drawWallFaceDetails(g, spec, cx, cy, cell, 1);
  } else {
    baseSprite.visible = false;
    drawWallShape(g, wall, cx, cy, cell, 1);
  }
}

function drawTowerRange(
  g: Graphics,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
  rangeMult: number,
): void {
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  if (t.kind === 'cursor') {
    dashedCircle(g, cx, cy, cursorRadius(t) * cell, PAL.navy, 1);
    return;
  }
  if (t.kind === 'repair') {
    dashedCircle(g, cx, cy, repairRadius(t) * cell, PAL.navy, 1);
    return;
  }
  const st = effectiveStats(t);
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

/** The classic white cursor arrow, tip at the origin, body extending down-right. */
const CURSOR_ARROW_PTS: readonly (readonly [number, number])[] = [
  [0, 0], [0, 13], [3.5, 10], [5.5, 16], [8, 14], [6.5, 10], [11, 10],
];

/** Draw a white arrow with a black outline, `length` px from tip to tail-bottom. */
function drawCursorArrow(g: Graphics, x: number, y: number, length: number, alpha = 1): void {
  const s = length / 16;
  const pts: number[] = [];
  for (const [px, py] of CURSOR_ARROW_PTS) pts.push(x + px * s, y + py * s);
  g.poly(pts).fill({ color: PAL.highlight, alpha }).stroke({ width: 1, color: PAL.dark, alpha });
}

/** Draw a flying cursor tower's arrow, its click ring, and the 2px dip on the click frame. */
function drawFlyingCursor(g: Graphics, t: Tower, board: { x: number; y: number; cell: number }): void {
  const px = board.x + t.cursorX * board.cell;
  const py = board.y + t.cursorY * board.cell;
  const dip = t.cursorClickFx === 8 ? 2 : 0;
  drawCursorArrow(g, px, py + dip, 12);
  if (t.cursorClickFx > 0) {
    const rx = board.x + t.cursorClickX * board.cell;
    const ry = board.y + t.cursorClickY * board.cell;
    g.circle(rx, ry, 6).stroke({ width: 1, color: PAL.highlight });
  }
}

function drawTowerShape(
  g: Graphics,
  kind: TowerKind,
  cx: number,
  cy: number,
  cell: number,
  alpha: number,
  angle = 0,
  branch: Branch | null = null,
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
    // Walls are drawn as buttons by drawWallShape, not here.
  } else if (kind === 'repair') {
    // A healing tower reads as a ring with a white cross: support, never a weapon.
    const r = Math.round(cell * 0.36);
    g.circle(cx, cy, r).fill(fill).stroke(outline);
    const arm = Math.round(cell * 0.26);
    const thick = Math.max(2, Math.round(cell * 0.08));
    g.moveTo(cx - arm / 2, cy).lineTo(cx + arm / 2, cy).stroke({ width: thick, color: PAL.highlight, alpha });
    g.moveTo(cx, cy - arm / 2).lineTo(cx, cy + arm / 2).stroke({ width: thick, color: PAL.highlight, alpha });
  } else if (kind === 'cursor') {
    // A small grey plinth with a cursor-shaped cap, so it reads as a tower when the cursor is away.
    const s = Math.round(cell * 0.4);
    const x = Math.round(cx - s / 2);
    const y = Math.round(cy - s / 2);
    g.rect(x, y, s, s).fill({ color: 0x9a9a9a, alpha }).stroke({ width: 1, color: PAL.dark, alpha });
    const arrowLen = Math.max(4, Math.round(cell * 0.3));
    drawCursorArrow(g, Math.round(cx - arrowLen / 2), Math.round(cy - arrowLen / 2), arrowLen, alpha);
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

  drawBranchMark(g, kind, branch, cx, cy, cell, fill, outline);
}

/** Draw a branch mark from its Pixi-free spec, using the tower's own fill and outline colours. */
function drawBranchMark(
  g: Graphics,
  kind: TowerKind,
  branch: Branch | null,
  cx: number,
  cy: number,
  cell: number,
  fill: { color: number; alpha: number },
  outline: { width: number; color: number; alpha: number },
): void {
  const spec = branchMarkSpec(kind, branch);
  if (spec === null) return;
  for (const p of spec.primitives) {
    drawMarkPrimitive(g, p, cx, cy, cell, fill, outline);
  }
}

function drawMarkPrimitive(
  g: Graphics,
  p: MarkPrimitive,
  cx: number,
  cy: number,
  cell: number,
  fill: { color: number; alpha: number },
  outline: { width: number; color: number; alpha: number },
): void {
  switch (p.type) {
    case 'rect':
      g.rect(cx + p.x * cell, cy + p.y * cell, p.w * cell, p.h * cell).fill(fill).stroke(outline);
      break;
    case 'line':
      g.moveTo(cx + p.x1 * cell, cy + p.y1 * cell).lineTo(cx + p.x2 * cell, cy + p.y2 * cell).stroke(outline);
      break;
    case 'poly':
      g.poly(p.pts.map((v, i) => (i % 2 === 0 ? cx : cy) + v * cell)).fill(fill).stroke(outline);
      break;
    case 'ring':
      g.circle(cx + p.x * cell, cy + p.y * cell, p.r * cell).stroke(outline);
      break;
    case 'arc':
      g.moveTo(cx + (p.x + Math.cos(p.a0) * p.r) * cell, cy + (p.y + Math.sin(p.a0) * p.r) * cell)
        .arc(cx + p.x * cell, cy + p.y * cell, p.r * cell, p.a0, p.a1)
        .stroke(outline);
      break;
  }
}

/** The fully-upgraded pip: a saturated green 4x4 square with a 1 px bright top-left highlight. */
function drawPip(g: Graphics, r: Rect): void {
  g.rect(r.x, r.y, r.w, r.h).fill({ color: PIP_FILL });
  g.rect(r.x, r.y, r.w, 1).fill({ color: PIP_HIGHLIGHT });
  g.rect(r.x, r.y, 1, r.h).fill({ color: PIP_HIGHLIGHT });
}

function wallBevel(
  g: Graphics,
  x: number,
  y: number,
  s: number,
  tl: readonly [number, number],
  br: readonly [number, number],
  alpha: number,
): void {
  g.moveTo(x, y + 0.5).lineTo(x + s, y + 0.5).stroke({ width: 1, color: tl[0], alpha });
  g.moveTo(x, y + 1.5).lineTo(x + s, y + 1.5).stroke({ width: 1, color: tl[1], alpha });
  g.moveTo(x, y + s - 1.5).lineTo(x + s, y + s - 1.5).stroke({ width: 1, color: br[1], alpha });
  g.moveTo(x, y + s - 0.5).lineTo(x + s, y + s - 0.5).stroke({ width: 1, color: br[0], alpha });
  g.moveTo(x + 0.5, y).lineTo(x + 0.5, y + s).stroke({ width: 1, color: tl[0], alpha });
  g.moveTo(x + 1.5, y).lineTo(x + 1.5, y + s).stroke({ width: 1, color: tl[1], alpha });
  g.moveTo(x + s - 1.5, y).lineTo(x + s - 1.5, y + s).stroke({ width: 1, color: br[1], alpha });
  g.moveTo(x + s - 0.5, y).lineTo(x + s - 0.5, y + s).stroke({ width: 1, color: br[0], alpha });
}

/** Draw a wall tower as a Windows button: face, bevel, and the Bulwark rim or Mesh crosshatch. */
function drawWallShape(
  g: Graphics,
  wall: WallState,
  cx: number,
  cy: number,
  cell: number,
  alpha: number,
): void {
  const spec = wallSpec(wall);
  const size = wallFootprintSize(cell);
  const x = Math.round(cx - size / 2);
  const y = Math.round(cy - size / 2);
  const s = Math.round(size);

  g.rect(x, y, s, s).fill({ color: spec.face, alpha });
  drawWallFaceDetails(g, spec, cx, cy, cell, alpha);
}

/** The wall's outline, bevel, Bulwark rim, Mesh crosshatch and repair hatch — the runtime chrome. */
function drawWallFaceDetails(g: Graphics, spec: WallSpec, cx: number, cy: number, cell: number, alpha: number): void {
  const size = wallFootprintSize(cell);
  const x = Math.round(cx - size / 2);
  const y = Math.round(cy - size / 2);
  const s = Math.round(size);

  g.rect(x + 0.5, y + 0.5, s - 1, s - 1).stroke({ width: 1, color: WALL_OUTLINE, alpha });
  wallBevel(g, x + 1, y + 1, s - 2, spec.tl, spec.br, alpha);

  if (spec.innerRim) {
    wallBevel(g, x + 4, y + 4, s - 8, RAISED_TL, RAISED_BR, alpha);
  }

  if (spec.crosshatch) {
    for (const seg of hatchSegments(x + 3, y + 3, s - 6, 4)) {
      g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha });
    }
  }

  if (spec.hatched) {
    for (const seg of repairHatch(x + 1, y + 1, s - 2, 4)) {
      g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha });
    }
  }
}

/** One family of down-right diagonal strokes across the square, for the repair hatch. */
function repairHatch(x: number, y: number, size: number, spacing: number): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let c = y - (x + size); c <= y + size - x; c += spacing) {
    const xin = Math.max(x, y - c);
    const xout = Math.min(x + size, y + size - c);
    if (xin < xout) out.push({ x1: xin, y1: xin + c, x2: xout, y2: xout + c });
  }
  return out;
}

/** A dotted 1 px focus rectangle, drawn around a selected wall. */
function drawWallFocus(g: Graphics, cx: number, cy: number, cell: number): void {
  const r = wallFocusRect(cx, cy, cell);
  const gap = 3;
  for (let px = r.x; px < r.x + r.w; px += gap) {
    g.rect(Math.round(px), Math.round(r.y), 1, 1).fill(PAL.title);
    g.rect(Math.round(px), Math.round(r.y + r.h - 1), 1, 1).fill(PAL.title);
  }
  for (let py = r.y; py < r.y + r.h; py += gap) {
    g.rect(Math.round(r.x), Math.round(py), 1, 1).fill(PAL.title);
    g.rect(Math.round(r.x + r.w - 1), Math.round(py), 1, 1).fill(PAL.title);
  }
}

/**
 * The enemy's body shape, shared by the live draw. `r` is the radius in pixels and `heading` orients
 * the leading edge (the weak point) of the asymmetric shapes. Each kind is a distinct silhouette at
 * 1x inside a cell: shape and outline carry the identity, colour only shades it.
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
  const thickOutline = { width: 2, color: PAL.dark, alpha };
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const perpX = -sin;
  const perpY = cos;
  const hex = (radius: number): number[] => {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      pts.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    return pts;
  };

  switch (kind) {
    case 'grunt': {
      // The filler enemy: a small circle with a 1 px inner dot, kept cheap because there are many.
      g.circle(x, y, r).fill(fill).stroke(outline);
      g.circle(x, y, 1).fill({ color: PAL.dark, alpha });
      break;
    }
    case 'runner': {
      // A narrow triangle pointing along its heading, with two short streaks trailing behind it.
      const nose = r * 1.5;
      const tail = r * 0.7;
      const halfW = r * 0.5;
      const tipX = x + cos * nose;
      const tipY = y + sin * nose;
      const bx = x - cos * tail;
      const by = y - sin * tail;
      g.poly([
        tipX, tipY,
        bx + perpX * halfW, by + perpY * halfW,
        bx - perpX * halfW, by - perpY * halfW,
      ]).fill(fill).stroke(outline);
      for (const s of [-1, 1]) {
        const sx = bx + perpX * halfW * s;
        const sy = by + perpY * halfW * s;
        g.moveTo(sx, sy).lineTo(sx - cos * r * 0.6, sy - sin * r * 0.6);
      }
      g.stroke({ width: 1, color: PAL.dark, alpha });
      break;
    }
    case 'shielded': {
      // A circle inside a hexagonal ring; the ring is drawn dimmer than the body.
      g.circle(x, y, r).fill(fill).stroke(outline);
      g.poly(hex(r * 1.35)).stroke({ width: 1, color, alpha: alpha * 0.45 });
      break;
    }
    case 'flyer': {
      // The elliptical shadow sits on the tile below the body; the body is a circle with two swept
      // wings trailing back off the heading.
      g.ellipse(x, y + r * 0.55, r * 1.15, r * 0.42).fill({ color: 0x17222b, alpha: alpha * 0.4 });
      g.circle(x, y, r * 0.62).fill(fill).stroke(outline);
      for (const s of [-1, 1]) {
        const rootX = x + perpX * s * r * 0.4;
        const rootY = y + perpY * s * r * 0.4;
        g.moveTo(rootX, rootY).lineTo(x - cos * r * 0.9 + perpX * s * r * 1.15, y - sin * r * 0.9 + perpY * s * r * 1.15);
      }
      g.stroke({ width: 2, color, alpha });
      break;
    }
    case 'armoured': {
      // A square with four corner rivets and a thicker 2 px outline.
      const s = r * 1.6;
      const x0 = x - s / 2;
      const y0 = y - s / 2;
      g.rect(x0, y0, s, s).fill(fill).stroke(thickOutline);
      for (const [rx, ry] of [[x0, y0], [x0 + s, y0], [x0, y0 + s], [x0 + s, y0 + s]]) {
        g.circle(rx, ry, 1.3).fill({ color: PAL.light, alpha });
      }
      break;
    }
    case 'saboteur': {
      // A diamond with a small fuse spark at the rear corner (opposite the heading).
      g.poly([x, y - r, x + r, y, x, y + r, x - r, y]).fill(fill).stroke(outline);
      const rearX = x - cos * r;
      const rearY = y - sin * r;
      const sparkR = Math.max(2, r * 0.55);
      for (let i = 0; i < 3; i++) {
        const a = heading + Math.PI + (i - 1) * 0.6;
        g.moveTo(rearX, rearY).lineTo(rearX + Math.cos(a) * sparkR, rearY + Math.sin(a) * sparkR);
      }
      g.stroke({ width: 1, color: PAL.amber, alpha });
      break;
    }
    case 'breacher': {
      // A rounded square with a jaw-notch cut into the leading edge and three teeth marks.
      const s = r * 1.6;
      const x0 = x - s / 2;
      const y0 = y - s / 2;
      g.roundRect(x0, y0, s, s, r * 0.35).fill(fill).stroke(thickOutline);
      const fx = x + cos * (s / 2);
      const fy = y + sin * (s / 2);
      const jawW = s * 0.5;
      const jawD = r * 0.75;
      const o1x = fx + perpX * (jawW / 2);
      const o1y = fy + perpY * (jawW / 2);
      const o2x = fx - perpX * (jawW / 2);
      const o2y = fy - perpY * (jawW / 2);
      g.poly([
        o1x, o1y,
        o2x, o2y,
        o2x - cos * jawD, o2y - sin * jawD,
        o1x - cos * jawD, o1y - sin * jawD,
      ]).fill({ color: PAL.dark, alpha });
      for (let k = 0; k < 3; k++) {
        const t = k / 2;
        const bx = o1x + (o2x - o1x) * t - cos * jawD;
        const by = o1y + (o2y - o1y) * t - sin * jawD;
        const tw = r * 0.16;
        g.poly([
          bx + perpX * tw, by + perpY * tw,
          bx - perpX * tw, by - perpY * tw,
          bx + cos * r * 0.5, by + sin * r * 0.5,
        ]).fill({ color: PAL.highlight, alpha });
      }
      break;
    }
    case 'boss': {
      // A large circle with a segmented outer rim and a crown notch at the top.
      g.circle(x, y, r).fill(fill).stroke(thickOutline);
      const rimR = r * 1.28;
      const span = (Math.PI * 2) / 12;
      for (let i = 0; i < 12; i++) {
        const a0 = span * i;
        const a1 = a0 + span * 0.65;
        g.moveTo(x + Math.cos(a0) * rimR, y + Math.sin(a0) * rimR)
          .arc(x, y, rimR, a0, a1)
          .stroke({ width: 1, color: PAL.dark, alpha });
      }
      const nw = r * 0.32;
      g.moveTo(x - nw, y - r).lineTo(x, y - r - r * 0.18).lineTo(x + nw, y - r).stroke({ width: 1, color: PAL.dark, alpha });
      break;
    }
    default: {
      // Pop-up (and any future kind) falls back to a plain hexagon; the live window is drawn by
      // drawPopupWindow, not here.
      g.poly(hex(r)).fill(fill).stroke(outline);
      break;
    }
  }
}

function drawPopupWindow(
  g: Graphics,
  e: Enemy,
  board: { x: number; y: number; cell: number },
  hoverClose: boolean,
): void {
  const r = popupWindowRect(e, board);
  bevel(g, r, true, PAL.face);
  const titleH = popupTitleH(r);
  g.rect(r.x + 2, r.y + 2, r.w - 4, titleH).fill(PAL.title);
  const close = popupCloseRect(e, board);
  bevel(g, close, true, hoverClose ? PAL.highlight : PAL.face);
  const cx = close.x + Math.floor(close.w / 2);
  const cy = close.y + Math.floor(close.h / 2);
  g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
  g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });
}

/** The flyer's non-rotating shadow, drawn beneath the body sprite (the SVG carries only the swept body). */
function drawFlyerShadow(g: Graphics, x: number, y: number, r: number, alpha: number): void {
  g.ellipse(x, y + r * 0.55, r * 1.15, r * 0.42).fill({ color: 0x17222b, alpha: alpha * 0.4 });
}

function drawEnemy(
  sprite: Sprite,
  bodies: Graphics,
  fx: Graphics,
  e: Enemy,
  board: { x: number; y: number; cell: number },
  cell: number,
  alpha: number,
  slowed: boolean,
  knockback?: { dx: number; dy: number } | null,
): void {
  let ex = (e.prevX + (e.x - e.prevX) * alpha) * cell + board.x;
  let ey = (e.prevY + (e.y - e.prevY) * alpha) * cell + board.y;
  if (knockback) {
    ex += knockback.dx;
    ey += knockback.dy;
  }
  const r = radiusOf(e) * cell;
  const color = ENEMY_COLOR[e.kind];

  // Body: the SVG sprite when the asset has loaded, otherwise the procedural shape (the temporary
  // fallback that keeps a half-finished art pass rendering; deleted once parity is confirmed). A
  // boss variant reuses its base type's asset, drawn at the base factor against its scaled radius.
  const name = artNameForEnemy(e.kind);
  const bodyPx = artSpriteSize(ENEMY_ART_BODY[e.kind] * r);
  const texture = name !== null ? getArtTexture(name, bodyPx) : null;
  if (texture !== null) {
    sprite.texture = texture;
    sprite.visible = true;
    sprite.position.set(ex, ey);
    sprite.width = bodyPx;
    sprite.height = bodyPx;
    sprite.rotation = ENEMY_ART_ROTATES.has(e.kind) ? e.heading : 0;
    sprite.alpha = 1;
    if (e.kind === 'flyer') drawFlyerShadow(bodies, ex, ey, r, 1);
  } else {
    sprite.visible = false;
    drawEnemyShape(bodies, baseEnemyKind(e.kind), ex, ey, r, color, e.heading);
  }

  // Boss variants get the runtime crown/notch motif that reads as "boss" without colour. The art
  // team can replace this with a proper per-boss asset later.
  if (isBossVariant(e.kind)) drawBossCrown(fx, ex, ey, r);

  // The shield ring: a Bastion draws one ring per remaining layer; everything else draws the single
  // shield ring whose alpha tracks the fraction left.
  if (e.shieldsRemaining > 0) {
    for (let i = 0; i < e.shieldsRemaining; i++) {
      fx.circle(ex, ey, r + 3 + i * 3).stroke({ width: 2, color: SHIELD_COLOR, alpha: 0.85 });
    }
  } else if (e.shield > 0) {
    const frac = e.maxShield > 0 ? Math.max(0, Math.min(1, e.shield / e.maxShield)) : 0;
    fx.circle(ex, ey, r + (e.kind === 'boss' ? 7 : 3)).stroke({
      width: 2,
      color: SHIELD_COLOR,
      alpha: 0.25 + 0.75 * frac,
    });
  }

  // The Pacer aura reads as a faint ring, drawn beneath the enemy's own markings.
  if (e.kind === 'runner-boss') drawPacerAura(fx, ex, ey, cell);

  // Weak-point notch: a short tick on the leading edge where a precision click pays double.
  {
    const n0 = r * 0.7;
    const n1 = r * 1.08;
    const nh = e.heading;
    fx.moveTo(ex + Math.cos(nh) * n0, ey + Math.sin(nh) * n0)
      .lineTo(ex + Math.cos(nh) * n1, ey + Math.sin(nh) * n1)
      .stroke({ width: 2, color: PAL.highlight });
  }

  if (slowed) {
    const sr = r + 2.5;
    const a0 = Math.PI * 0.2;
    const a1 = Math.PI * 0.8;
    fx.moveTo(ex + Math.cos(a0) * sr, ey + Math.sin(a0) * sr)
      .arc(ex, ey, sr, a0, a1)
      .stroke({ width: 1, color: SLOW_COLOR });
  }

  const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 0;
  if (isBossKind(e.kind)) {
    // A boss always shows a health bar, even at full health, so its durability reads at a glance.
    const bw = r * 2.2;
    const by0 = ey - r - 8;
    fx.rect(ex - bw / 2, by0, bw, 3).fill({ color: PAL.dark });
    fx.rect(ex - bw / 2 + 1, by0 + 1, Math.max(0, (bw - 2) * ratio), 1).fill({ color: healthColor(ratio) });
  } else if (ratio < 1) {
    const arcR = r + 4;
    const a0 = -Math.PI / 2 - Math.PI * ratio;
    const a1 = -Math.PI / 2 + Math.PI * ratio;
    fx.moveTo(ex + Math.cos(a0) * arcR, ey + Math.sin(a0) * arcR)
      .arc(ex, ey, arcR, a0, a1)
      .stroke({
        width: 2,
        color: healthColor(ratio),
      });
  }
}

/** A crown/notch tick at the top of a boss-variant silhouette, mirroring the marker boss's crown. */
function drawBossCrown(g: Graphics, x: number, y: number, r: number): void {
  const nw = r * 0.32;
  g.moveTo(x - nw, y - r).lineTo(x, y - r - r * 0.18).lineTo(x + nw, y - r).stroke({ width: 1, color: PAL.dark });
}

/** The Pacer's aura: a faint ring with short radial speed ticks, drawn at its 3-tile radius. */
function drawPacerAura(g: Graphics, x: number, y: number, cell: number): void {
  const radius = PACER_AURA_RADIUS * cell;
  g.circle(x, y, radius).stroke({ width: 1, color: AURA_COLOR, alpha: 0.35 });
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    g.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius)
      .lineTo(x + Math.cos(a) * (radius - 4), y + Math.sin(a) * (radius - 4))
      .stroke({ width: 1, color: AURA_COLOR, alpha: 0.35 });
  }
}

function healthColor(ratio: number): number {
  const red = Math.round(0xc0 * (1 - ratio));
  const green = Math.round(0xc0 * ratio);
  return (red << 16) | (green << 8);
}

/** The repair progress bar colour: a blue that never reads as health (green/red). */
const REPAIR_COLOR = 0x0080c0;

/** A thin bar above a wall: dark track with a `ratio`-wide fill in `color`. */
function drawBar(g: Graphics, cx: number, cy: number, cell: number, ratio: number, color: number): void {
  const r = Math.max(0, Math.min(1, ratio));
  const bar = healthBarRect(cx, cy, cell);
  g.rect(bar.x, bar.y, bar.w, bar.h).fill({ color: PAL.dark });
  g.rect(bar.x + 1, bar.y + 1, Math.max(0, Math.round((bar.w - 2) * r)), 1).fill({ color });
}

/** An offline tower's marking: a desaturating wash over the body plus a small red crossed wrench. */
function drawOfflineTag(g: Graphics, cx: number, cy: number, cell: number): void {
  const half = cell / 2;
  g.rect(cx - half, cy - half, cell, cell).fill({ color: 0x808080, alpha: 0.35 });
  const s = Math.max(3, Math.round(cell * 0.16));
  const x0 = Math.round(cx - half + 3);
  const y0 = Math.round(cy - half + 3);
  g.moveTo(x0, y0).lineTo(x0 + s, y0 + s);
  g.moveTo(x0 + s, y0).lineTo(x0, y0 + s);
  g.stroke({ width: 2, color: 0xd00000 });
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
