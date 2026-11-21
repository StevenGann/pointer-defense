import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { artNameForBranch, artNameForTowerBase, artNameForTowerTurret, artSpriteSize, enemyArtNames, frameTexture, frameTextureFor, getArtFrames, getArtTexture, hasArt } from './art.ts';
import { lifetimeFrame } from './anim.ts';
import { bevel, FONT, FONT_SIZE, PAL, type BoardGeometry, type Layout } from './chrome.ts';
import {
  enemyAt,
  canPlace,
  disabledTowerIds,
  healedTowerIds,
  towerAt,
  towerAuraSources,
  currentRoutes,
  selectedTower,
  synergyLayout,
  towerRangeMult,
  effectiveRange,
  type Mine,
  type RunState,
} from '../core/state.ts';
import { SYNERGIES, type SynergyEdge } from '../core/synergy.ts';
import {
  baseEnemyKind,
  isBossKind,
  isBossVariant,
  isFlyerKind,
  PACER_AURA_RADIUS,
  radiusOf,
  WIRECUTTER_EMP_RADIUS,
  type Enemy,
  type EnemyKind,
} from '../core/enemies.ts';
import { cursorRadius, effectiveStats, isEmpDisabled, isFullyUpgraded, isGateLocked, isOffline, isRepairing, repairProgress, repairRadius, TOWER_STATS, type Branch, type Tower, type TowerKind } from '../core/towers.ts';
import { tileAt, COLS, ROWS, type Grid, type Tile } from '../core/grid.ts';
import { TICK_HZ } from '../core/time.ts';
import { toggleOpenAt, togglePhase, toggleProgress, type LevelToggle } from '../core/levels.ts';
import { dashRects, offsetSegment, routeOffset, type RouteSegment } from './route.ts';
import {
  hatchSegments,
  lerpColor,
  RAISED_BR,
  RAISED_TL,
  wallArt,
  wallButtonSpec,
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
import type { QualityLevel } from '../core/quality.ts';
import { t } from '../i18n/index.ts';

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
  aa: 0x5a7d9a,
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
/** Debug-only layer switches for profiling: `?hide=route,shadows,enemies`. Never set in play. */
const PERF_HIDDEN: ReadonlySet<string> = (() => {
  if (typeof location === 'undefined') return new Set<string>();
  const raw = new URLSearchParams(location.search).get('hide');
  return new Set(raw ? raw.split(',').filter(Boolean) : []);
})();

export function staticLayerKey(
  state: Pick<RunState, 'levelId' | 'grid'>,
  board: BoardGeometry,
): string {
  const levelId = state.levelId;
  const cols = state.grid.cols;
  const rows = state.grid.rows;
  const bx = board.x;
  const by = board.y;
  const cell = board.cell;
  return levelId + '|' + cols + 'x' + rows + '|' + bx + ',' + by + ',' + cell;
}

/**
 * Identity of the live route layer: the tile lists creeps follow right now. It changes only when the
 * maze changes — a tower placement or sale, a toggle flip, or a map switch — so the route is redrawn
 * on those events and left alone across ordinary ticks. The cell size is not part of the key because
 * a resize (or DPR change) already rebuilds the static layer, which drops the cached route with it.
 */
export function routeKey(state: RunState): string {
  const routes = currentRoutes(state);
  const count = routes.length;
  return routes
    .map((route, i) => {
      const cells = route
        .map((t) => {
          const col = t.col;
          const row = t.row;
          return col + ',' + row;
        })
        .join('|');
      return count + ':' + i + ':' + cells;
    })
    .join(';');
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
  breacher: 0x5a7183,
  popup: 0x000080,
  'grunt-boss': 0x35506a,
  'runner-boss': 0x577489,
  'shielded-boss': 0x2f4b62,
  'flyer-boss': 0x6b8598,
  'armoured-boss': 0x406080,
  'saboteur-boss': 0x4a637a,
  'breacher-boss': 0x5a7183,
};

/** The single cyan for shield visuals: the shield ring, the impact arc and the `SHD` floater. */
export const SHIELD_COLOR = 0x00d0d0;

/**
 * The board's nominal cell size, in px. The Help viewer's art preview (docs/HELP-ART.md) scales its
 * sprite from this single reference so a tower body or enemy silhouette previews at exactly twice the
 * board's in-game size without either view hardcoding a pixel figure.
 */
export const HELP_REFERENCE_CELL = 48;

/**
 * The SVG silhouette's on-screen bounding diameter, in units of the enemy's pixel radius `r`. The
 * art is authored to fill the 32x32 viewBox's 28px silhouette, and the sprite is sized so that
 * silhouette spans `factor × r` pixels — the same box the procedural body occupied.
 */
export const ENEMY_ART_BODY: Record<EnemyKind, number> = {
  grunt: 2.0,
  // Drawn larger than its hitbox so the dart reads at Grunt size (3.3 × 0.18 ≈ 2.0 × 0.3). Its tip
  // stays inside the click radius plus CLICK_SLACK, so every visible part of it is still clickable.
  runner: 3.3,
  shielded: 2.7,
  flyer: 2.6,
  armoured: 1.6,
  saboteur: 2.4,
  breacher: 2.2,
  popup: 2.0,
  'grunt-boss': 2.0,
  'runner-boss': 3.3,
  'shielded-boss': 2.7,
  'flyer-boss': 2.6,
  'armoured-boss': 1.6,
  'saboteur-boss': 2.4,
  // The Ram's art gives the front of its box to the drill, so its hull is drawn smaller in the box;
  // 2.9 keeps the hull the Breacher's size against the radius, with the drill reaching ~1.6 r ahead.
  'breacher-boss': 2.9,
};

/** Kinds whose silhouette is oriented: they rotate with the enemy's heading. The rest are symmetric. */
export const ENEMY_ART_ROTATES: ReadonlySet<EnemyKind> = new Set([
  'runner', 'flyer', 'saboteur', 'breacher', 'runner-boss', 'flyer-boss', 'saboteur-boss', 'breacher-boss',
]);

/**
 * Enemy shadows (design.md section 24). Each sprite-backed enemy casts a second sprite sharing the
 * body's exact frame texture, tinted black (tint multiplies RGB, alpha is kept) at a fixed alpha and
 * offset down-right in screen px, so the offset does not grow with the cell size.
 */
export const SHADOW_TINT = 0x000000;
export const SHADOW_ALPHA = 0.32;
export const SHADOW_OFFSET: Readonly<{ x: number; y: number }> = Object.freeze({ x: 2, y: 3 });
/** Flyers are airborne, so their shadow is thrown further. */
export const SHADOW_OFFSET_FLYER: Readonly<{ x: number; y: number }> = Object.freeze({ x: 7, y: 10 });
/** The Carrier (flyer-boss) is a bigger airborne body: 1.5x the flyer offset, rounded to whole px. */
export const SHADOW_OFFSET_FLYER_BOSS_SCALE = 1.5;
export const SHADOW_OFFSET_FLYER_BOSS: Readonly<{ x: number; y: number }> = Object.freeze({
  x: Math.round(SHADOW_OFFSET_FLYER.x * SHADOW_OFFSET_FLYER_BOSS_SCALE),
  y: Math.round(SHADOW_OFFSET_FLYER.y * SHADOW_OFFSET_FLYER_BOSS_SCALE),
});

/**
 * The screen-space shadow offset for an enemy kind: the Carrier's scaled offset for the flyer-boss,
 * the flyer offset for other flyers, the ground one otherwise.
 */
export function shadowOffsetFor(kind: EnemyKind): Readonly<{ x: number; y: number }> {
  if (kind === 'flyer-boss') return SHADOW_OFFSET_FLYER_BOSS;
  return isFlyerKind(kind) ? SHADOW_OFFSET_FLYER : SHADOW_OFFSET;
}

/** Whether an enemy kind casts a shadow. Pop-ups are windows, not creatures, and cast nothing. */
export function shadowVisibleFor(kind: EnemyKind): boolean {
  return kind !== 'popup';
}

/**
 * Whether the shadow layer is drawn for an enemy kind at a given quality level: every shadow in
 * `full`, bosses only in `no-shadows` (the Carrier is a flyer boss, so it is included), none in
 * `lean`.
 */
export function shadowDrawnFor(kind: EnemyKind, quality: QualityLevel): boolean {
  if (quality === 'lean') return false;
  if (quality === 'no-shadows') return isBossKind(kind);
  return true;
}

/**
 * Whether a non-boss enemy draws a health arc: it has taken damage, or it carries shield points.
 * Bosses are handled separately (they always draw a full health bar).
 */
export function enemyHealthBarVisible(e: Enemy): boolean {
  if (isBossKind(e.kind)) return true;
  return (e.maxHp > 0 && e.hp < e.maxHp) || e.shield > 0 || e.shieldsRemaining > 0;
}

/**
 * The board root's child order, back to front. `shadows` sits after the route and before mines, so a
 * shadow lies on the floor beneath mines, walls, towers, pop-ups and enemies.
 */
export const BOARD_LAYER_ORDER = Object.freeze([
  'tileSprites', 'tiles', 'path', 'shadows', 'mines', 'mineArt', 'shutterSprites', 'toggles', 'synergy', 'towerSprites',
  'towers', 'auras', 'wrenches', 'popups', 'enemies', 'enemyBodies', 'enemyFx', 'cursorArrows', 'ghost', 'overlay',
  'projectileArt',
] as const);
export type BoardLayerName = (typeof BOARD_LAYER_ORDER)[number];

const AURA_COLOR = 0x6699ff;
const SLOW_COLOR = 0x00d0ff;

/** The four tower-status auras, one sprite per status per tower (docs/TOWER-AURAS.md). */
const AURA_STATUSES = ['heal', 'beacon', 'override', 'emp'] as const;
type AuraStatus = (typeof AURA_STATUSES)[number];
const AURA_ASSET: Record<AuraStatus, string> = {
  heal: 'aura-heal',
  beacon: 'aura-beacon',
  override: 'aura-override',
  emp: 'aura-emp',
};

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
  private readonly shadows = new Container();
  private readonly shadowSprites: Sprite[] = [];
  private readonly mines = new Graphics();
  private readonly shutterSprites = new Container();
  private readonly shutterSpritePool: Sprite[] = [];
  private readonly toggles = new Graphics();
  // The synergy layer holds the procedural fallback first and the artist's sprites above it, so the
  // line is visible even before the SVGs have finished loading.
  private readonly synergyLayer = new Container();
  private readonly synergy = new Graphics();
  private readonly synergyArt = new Container();
  private readonly synergyHalos: Sprite[] = [];
  private readonly synergyLinks: Sprite[] = [];
  private readonly towers = new Graphics();
  private readonly auras = new Container();
  private readonly auraSprites: Sprite[] = [];
  private readonly wrenches = new Container();
  private readonly wrenchSprites: Sprite[] = [];
  private readonly towerSprites = new Container();
  private readonly towerBaseSprites: Sprite[] = [];
  private readonly towerTurretSprites: Sprite[] = [];
  private readonly towerMarkSprites: Sprite[] = [];
  private readonly wallOverlaySprites: Sprite[] = [];
  private readonly popups = new Container();
  private readonly popupGfx = new Graphics();
  private readonly tileSprites = new Container();
  private readonly enemies = new Container();
  private readonly enemyBodies = new Graphics();
  private readonly enemyFx = new Graphics();
  private readonly enemySprites: Sprite[] = [];
  private readonly cursorArrows = new Container();
  private readonly cursorArrowSprites: Sprite[] = [];
  private readonly cursorFxSprites: Sprite[] = [];
  private readonly ghost = new Container();
  private readonly ghostBase = new Sprite();
  private readonly ghostTurret = new Sprite();
  private readonly mineArt = new Container();
  private readonly mineArtPool: Sprite[] = [];
  private readonly projectileArt = new Container();
  private readonly projectileArtPool: Sprite[] = [];
  private readonly overlay = new Graphics();
  private readonly popupTexts: { title: Text; message: Text }[] = [];

  private staticKey = '';
  private pathKey = '';

  /** Tower id -> the sim tick it last fired, for a Mortar's turret recoil (docs/MORTAR-RECOIL.md). */
  private readonly recoilTicks = new Map<number, number>();

  constructor() {
    this.ghostBase.anchor.set(0.5, 0.5);
    this.ghostTurret.anchor.set(0.5, 0.5);
    this.ghostBase.visible = false;
    this.ghostTurret.visible = false;
    this.ghost.addChild(this.ghostBase, this.ghostTurret);
    this.popups.addChild(this.popupGfx);
    const layers: Record<BoardLayerName, Container> = {
      tileSprites: this.tileSprites,
      tiles: this.tiles,
      path: this.path,
      shadows: this.shadows,
      mines: this.mines,
      mineArt: this.mineArt,
      shutterSprites: this.shutterSprites,
      toggles: this.toggles,
      synergy: this.synergyLayer,
      towerSprites: this.towerSprites,
      towers: this.towers,
      auras: this.auras,
      wrenches: this.wrenches,
      popups: this.popups,
      enemies: this.enemies,
      enemyBodies: this.enemyBodies,
      enemyFx: this.enemyFx,
      cursorArrows: this.cursorArrows,
      ghost: this.ghost,
      overlay: this.overlay,
      projectileArt: this.projectileArt,
    };
    this.synergyLayer.addChild(this.synergy, this.synergyArt);
    for (const name of BOARD_LAYER_ORDER) this.root.addChild(layers[name]);
  }

  /** The pooled halo sprite for the `index`-th clustered tower this frame, grown on demand. */
  private synergyHaloSprite(index: number): Sprite {
    let s = this.synergyHalos[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.synergyArt.addChild(s);
      this.synergyHalos[index] = s;
    }
    return s;
  }

  /** The pooled link sprite for the `index`-th synergy edge this frame, grown on demand. */
  private synergyLinkSprite(index: number): Sprite {
    let s = this.synergyLinks[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.synergyArt.addChild(s);
      this.synergyLinks[index] = s;
    }
    return s;
  }

  /** The pooled shadow sprite for the `index`-th shadow cast this frame, grown on demand. */
  private shadowSprite(index: number): Sprite {
    let s = this.shadowSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      s.tint = SHADOW_TINT;
      s.alpha = SHADOW_ALPHA;
      this.shadowSprites.push(s);
      this.shadows.addChild(s);
    }
    s.visible = true;
    return s;
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

  /** The pooled fire-effect sprite for the `index`-th cursor, drawn where its click landed. */
  private cursorFxSprite(index: number): Sprite {
    let s = this.cursorFxSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.cursorFxSprites.push(s);
      this.cursorArrows.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled sprite for the `index`-th drawn mine, grown on demand. */
  private mineArtSprite(index: number): Sprite {
    let s = this.mineArtPool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.mineArtPool.push(s);
      this.mineArt.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled sprite for the `index`-th in-flight projectile, grown on demand. */
  private projectileArtSprite(index: number): Sprite {
    let s = this.projectileArtPool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.projectileArtPool.push(s);
      this.projectileArt.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled arrow sprite for the `index`-th flying cursor, grown on demand. */
  private cursorArrowSprite(index: number): Sprite {
    let s = this.cursorArrowSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0, 0);
      this.cursorArrowSprites.push(s);
      this.cursorArrows.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled sprite for the `index`-th shutter tile, grown on demand. */
  private shutterSprite(index: number): Sprite {
    let s = this.shutterSpritePool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.shutterSpritePool.push(s);
      this.shutterSprites.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled aura sprite for the `index`-th status slot, grown on demand. */
  private auraSprite(index: number): Sprite {
    let s = this.auraSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.auraSprites.push(s);
      this.auras.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** The pooled sprite for the `index`-th offline-tower wrench mark, grown on demand. */
  private wrenchSprite(index: number): Sprite {
    let s = this.wrenchSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.wrenchSprites.push(s);
      this.wrenches.addChild(s);
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

  /** The pooled sprite for the `index`-th wall overlay (branch mark, damage or repair hatch). */
  private wallOverlaySprite(index: number): Sprite {
    let s = this.wallOverlaySprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.wallOverlaySprites.push(s);
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

  /** Record that `id` fired this tick, so its turret shakes for the recoil duration. */
  noteRecoil(id: number, tick: number): void {
    this.recoilTicks.set(id, tick);
  }

  draw(
    state: RunState,
    l: Layout,
    alpha: number,
    hover: BoardHover,
    knockbackFor?: (id: number, tick: number) => { dx: number; dy: number } | null,
    quality: QualityLevel = 'full',
    showSynergy: boolean = true,
  ): void {
    const { board } = l;
    const cell = board.cell;

    const layerKey = staticLayerKey(state, board);
    if (layerKey !== this.staticKey) {
      this.staticKey = layerKey;
      this.pathKey = '';
      this.drawStatic(state.grid, board, cell);
    }

    if (!PERF_HIDDEN.has('route')) {
      const rkey = routeKey(state);
      if (rkey !== this.pathKey) {
        this.pathKey = rkey;
        this.drawRoute(currentRoutes(state), board, cell);
      }
    }

    this.mines.clear();
    let mineArtIndex = 0;
    for (const m of state.mines) {
      const armed = state.clock >= m.armedAtTick;
      // Mines animate on the fps clock from the tick they were laid; the id spreads the blink phases.
      const tex = frameTexture(armed ? 'mine-armed' : 'mine-unarmed', Math.round(cell * 0.5), state.clock - m.placedTick, m.id);
      if (tex === null) {
        drawMine(this.mines, m, board, cell, state.clock);
        continue;
      }
      const spr = this.mineArtSprite(mineArtIndex++);
      spr.texture = tex;
      spr.width = cell * 0.5;
      spr.height = cell * 0.5;
      spr.position.set(board.x + m.x * cell, board.y + m.y * cell);
      // The file carries the lamp colour; alpha is the only runtime difference between states.
      spr.alpha = armed ? 1 : 0.5;
      spr.rotation = 0;
      if (armed) {
        const pr = cell * 0.16 * (1.35 + 0.15 * Math.sin(state.clock * 0.35));
        this.mines.circle(board.x + m.x * cell, board.y + m.y * cell, pr).stroke({ width: 1, color: PAL.dark, alpha: 0.35 });
      }
    }
    for (let i = mineArtIndex; i < this.mineArtPool.length; i++) this.mineArtPool[i].visible = false;

    this.towers.clear();
    this.enemyBodies.clear();
    this.enemyFx.clear();
    this.popupGfx.clear();
    this.overlay.clear();

    this.synergy.clear();
    let haloIndex = 0;
    let linkIndex = 0;
    if (showSynergy) {
      const layout = synergyLayout(state);
      const { alpha } = synergyEdgeStyle(state.clock, quality, edgePeriod());
      const haloPx = Math.round(cell * SYNERGY_HALO_CELLS);
      const haloTex = getArtTexture('synergy-halo', haloPx);
      if (haloTex !== null) {
        // The halo is reserved for symmetric rows: it means "these are peers", and only clusters
        // carry it. A one-way gift never gets one (docs/SYNERGIES.md §9).
        for (const cluster of layout.clusters) {
          for (const t of cluster.members) {
            const spr = this.synergyHaloSprite(haloIndex++);
            const size = cell * SYNERGY_HALO_CELLS;
            spr.texture = haloTex;
            spr.tint = cluster.color;
            spr.width = size;
            spr.height = size;
            spr.rotation = 0;
            spr.position.set(board.x + (t.col + 0.5) * cell, board.y + (t.row + 0.5) * cell);
            spr.alpha = alpha * SYNERGY_HALO_ALPHA;
            spr.visible = true;
          }
        }
      }
      for (const edge of layout.edges) {
        // Each row ships its own link art, so the texture is chosen per edge. getArtTexture is
        // cached by name and size, so this is a map lookup, not a per-frame raster.
        const linkTex = getArtTexture(edge.link, Math.round(haloPx * SYNERGY_LINK_TEXTURE_SCALE));
        if (linkTex === null) {
          // Before this row's SVG lands (or if the artist removes it) the procedural dash still draws.
          drawSynergyEdge(this.synergy, edge, board, cell, state.clock, quality);
        } else {
          const { x0, y0, x1, y1 } = synergyEdgeEndpoints(edge, board, cell);
          const spr = this.synergyLinkSprite(linkIndex++);
          spr.texture = linkTex;
          spr.tint = edge.color;
          spr.width = Math.hypot(x1 - x0, y1 - y0) + cell * SYNERGY_LINK_OVERLAP;
          spr.height = cell * SYNERGY_LINK_HEIGHT;
          // Adjacency is orthogonal, so the link is only ever horizontal or vertical.
          spr.rotation = edge.lead.col === edge.follow.col ? Math.PI / 2 : 0;
          // The spotter's chevron points +x in its art; mirror it when the lead sits east or south
          // so the gift always points from lead to follow, never the other way.
          if (edge.follow.col < edge.lead.col || edge.follow.row < edge.lead.row) spr.scale.x *= -1;
          spr.position.set((x0 + x1) / 2, (y0 + y1) / 2);
          spr.alpha = alpha * SYNERGY_LINK_ALPHA;
          spr.visible = true;
        }
        // A row with a mark draws it at the link midpoint with the same pooled Graphics object, so
        // four more rows are told apart without four more SVGs (docs/SYNERGIES-BATCH-2.md §0).
        if (edge.mark !== undefined) {
          const { x0, y0, x1, y1 } = synergyEdgeEndpoints(edge, board, cell);
          drawSynergyMark(this.synergy, edge.mark, (x0 + x1) / 2, (y0 + y1) / 2, edge.color, alpha, cell);
        }
      }
    }
    for (let i = haloIndex; i < this.synergyHalos.length; i++) this.synergyHalos[i].visible = false;
    for (let i = linkIndex; i < this.synergyLinks.length; i++) this.synergyLinks[i].visible = false;

    this.toggles.clear();
    let shutterIndex = 0;
    for (const tg of state.toggles) {
      drawShutter(this.toggles, this.shutterSprite(shutterIndex), tg, board, cell, state.clock);
      shutterIndex++;
    }
    for (let i = shutterIndex; i < this.shutterSpritePool.length; i++) this.shutterSpritePool[i].visible = false;

    let towerIndex = 0;
    let wallOverlayIndex = 0;
    // Recoil ticks are presentation-only: drop towers that no longer exist and shots whose shake has
    // run out, so the map never accumulates entries across a long run.
    if (this.recoilTicks.size > 0) {
      const liveIds = new Set(state.towers.map((t) => t.id));
      for (const [id, fireTick] of this.recoilTicks) {
        if (!liveIds.has(id) || state.clock - fireTick >= RECOIL_DURATION_TICKS) this.recoilTicks.delete(id);
      }
    }
    for (const t of state.towers) {
      const baseSprite = this.towerBaseSprite(towerIndex);
      const turretSprite = this.towerTurretSprite(towerIndex);
      const markSprite = this.towerMarkSprite(towerIndex);
      const wrenchSprite = this.wrenchSprite(towerIndex);
      // Wall overlays are drawn after the base so they sit on top of the face sprite.
      const overlayA = t.kind === 'wall' ? this.wallOverlaySprite(wallOverlayIndex++) : null;
      const overlayB = t.kind === 'wall' ? this.wallOverlaySprite(wallOverlayIndex++) : null;
      drawTower(baseSprite, turretSprite, markSprite, wrenchSprite, this.towers, t, board, cell, state.clock, overlayA, overlayB, quality, this.recoilTicks.get(t.id) ?? null);
      towerIndex++;
    }
    for (let i = towerIndex; i < this.towerBaseSprites.length; i++) this.towerBaseSprites[i].visible = false;
    for (let i = towerIndex; i < this.towerTurretSprites.length; i++) this.towerTurretSprites[i].visible = false;
    for (let i = towerIndex; i < this.towerMarkSprites.length; i++) this.towerMarkSprites[i].visible = false;
    for (let i = towerIndex; i < this.wrenchSprites.length; i++) this.wrenchSprites[i].visible = false;
    for (let i = wallOverlayIndex; i < this.wallOverlaySprites.length; i++) this.wallOverlaySprites[i].visible = false;

    // Tower-status auras: one sprite per status per tower, cycling on the asset's own animation while
    // the status holds and hidden otherwise. They sit in their own layer above the plinth and never
    // take pointer events (all board hit-tests are coordinate-based). `lean` skips them entirely.
    if (quality !== 'lean') {
      const healed = healedTowerIds(state);
      const auraSources = towerAuraSources(state);
      const disabled = disabledTowerIds(state);
      let auraIndex = 0;
      for (const t of state.towers) {
        const active: Record<AuraStatus, boolean> = {
          heal: healed.has(t.id),
          beacon: auraSources.get(t.id)?.has('beacon') ?? false,
          override: auraSources.get(t.id)?.has('override') ?? false,
          emp: disabled.has(t.id),
        };
        for (const status of AURA_STATUSES) {
          const sprite = this.auraSprite(auraIndex++);
          if (!active[status]) {
            sprite.visible = false;
            continue;
          }
          const tex = frameTexture(AURA_ASSET[status], cell, state.clock, t.id);
          if (tex === null) {
            sprite.visible = false;
            continue;
          }
          sprite.texture = tex;
          sprite.visible = true;
          sprite.position.set(board.x + (t.col + 0.5) * cell, board.y + (t.row + 0.5) * cell);
          sprite.width = cell;
          sprite.height = cell;
          sprite.tint = 0xffffff;
          sprite.rotation = 0;
          sprite.alpha = 1;
        }
      }
      for (let i = auraIndex; i < this.auraSprites.length; i++) this.auraSprites[i].visible = false;
    } else {
      for (const s of this.auraSprites) s.visible = false;
    }

    const hoveredTower = hover.onBoard ? towerAt(state, hover.col, hover.row) : undefined;
    if (hoveredTower) drawTowerRange(this.overlay, hoveredTower, board, cell, state);

    const inspected = selectedTower(state);
    if (inspected) {
      if (inspected !== hoveredTower) drawTowerRange(this.overlay, inspected, board, cell, state);
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
    const layers = PERF_HIDDEN.has('enemies') ? { popups: [], others: [] } : enemyDrawOrder(state.enemies);
    const overClose = (e: Enemy): boolean => hover.onBoard && popupCloseHit(e, board, hover.x, hover.y);
    let pi = 0;
    for (const e of layers.popups) {
      if (e.dead) continue;
      const { title, message } = this.popupText(pi);
      drawPopupWindow(this.popupGfx, e, board, overClose(e));
      const r = popupWindowRect(e, board);
      const titleH = popupTitleH(r);
      title.text = t('screen.board.popupTitle');
      title.position.set(r.x + 5, r.y + 2 + Math.floor(titleH / 2));
      message.text = t('screen.board.popupMessage');
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
    let shadowIndex = 0;
    const drawShadows = !PERF_HIDDEN.has('shadows');
    for (const e of layers.others) {
      if (e.dead) continue;
      const kb = knockbackFor ? knockbackFor(e.id, state.tick) : null;
      const body = this.enemySprite(spriteIndex);
      drawEnemy(body, this.enemyBodies, this.enemyFx, e, board, cell, alpha, state.tick < e.slowUntilTick, state.tick, kb);
      spriteIndex++;
      // The shadow copies the body sprite exactly (same frame texture, size, rotation, knockback-
      // adjusted position) and is only cast when the body is sprite-backed; a procedural fallback
      // has no texture to copy.
      if (drawShadows && body.visible && shadowVisibleFor(e.kind) && shadowDrawnFor(e.kind, quality)) {
        const off = shadowOffsetFor(e.kind);
        const sh = this.shadowSprite(shadowIndex++);
        sh.texture = body.texture;
        sh.width = body.width;
        sh.height = body.height;
        sh.rotation = body.rotation;
        sh.position.set(body.position.x + off.x, body.position.y + off.y);
        sh.tint = SHADOW_TINT;
        sh.alpha = SHADOW_ALPHA;
      }
    }
    for (let i = spriteIndex; i < this.enemySprites.length; i++) {
      this.enemySprites[i].visible = false;
    }
    for (let i = shadowIndex; i < this.shadowSprites.length; i++) {
      this.shadowSprites[i].visible = false;
    }

    // In-flight projectiles draw above enemies: a small square for a Flak shell, a tapered dart with
    // a fading trail for a missile.
    drawProjectiles(this.overlay, this.projectileArtSprite.bind(this), this.projectileArtPool, state, board);

    // The flying cursor arrows live above the enemy layer so they are always visible.
    let arrowIndex = 0;
    for (const t of state.towers) {
      if (t.kind === 'cursor') {
        const fx = drawFlyingCursor(this.overlay, this.cursorArrowSprite(arrowIndex), t, board, cell);
        const fxSpr = this.cursorFxSprite(arrowIndex);
        if (fx === null) {
          fxSpr.visible = false;
        } else {
          fxSpr.texture = fx.texture;
          fxSpr.width = fx.size;
          fxSpr.height = fx.size;
          fxSpr.position.set(fx.x, fx.y);
          fxSpr.alpha = fx.alpha;
        }
        arrowIndex++;
      }
    }
    for (let i = arrowIndex; i < this.cursorArrowSprites.length; i++) this.cursorArrowSprites[i].visible = false;
    for (let i = arrowIndex; i < this.cursorFxSprites.length; i++) this.cursorFxSprites[i].visible = false;

    if (state.selected && hover.onBoard && canPlace(state, state.selected, hover.col, hover.row)) {
      const cx = board.x + (hover.col + 0.5) * cell;
      const cy = board.y + (hover.row + 0.5) * cell;
      drawGhost(this.ghostBase, this.ghostTurret, this.overlay, state.selected, cx, cy, cell);
      dashedCircle(this.overlay, cx, cy, TOWER_STATS[state.selected].range * cell, PAL.navy, 1);
    } else {
      this.ghostBase.visible = false;
      this.ghostTurret.visible = false;
    }

    if (state.pointer.stage >= 2 && state.phase === 'wave') {
      drawReticle(this.overlay, state, board, cell);
    }

  }

  /**
   * Invalidate every art-derived cache so the next frame re-reads the texture lookup. Called once
   * when the async art preload completes, and again on a DPR change. The static tile layer is keyed
   * (see {@link staticLayerKey}), so without this it keeps the procedural fallback it drew before the
   * SVG decoded; the pooled tower, tile and enemy sprites are released so a texture that was null at
   * draw time is re-pointed at the loaded one, and the placement ghost sprites are re-pointed too.
   */
  invalidateArt(): void {
    this.staticKey = '';

    this.towerSprites.removeChildren();
    this.towerBaseSprites.length = 0;
    this.towerTurretSprites.length = 0;
    this.towerMarkSprites.length = 0;
    this.wallOverlaySprites.length = 0;

    this.auras.removeChildren();
    this.auraSprites.length = 0;

    this.tileSprites.removeChildren();

    this.enemies.removeChildren();
    this.enemySprites.length = 0;

    this.shadows.removeChildren();
    this.shadowSprites.length = 0;

    this.ghostBase.texture = Texture.EMPTY;
    this.ghostTurret.texture = Texture.EMPTY;
    this.ghostBase.visible = false;
    this.ghostTurret.visible = false;
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
        const name = kind === 'blocked' ? 'obstacle' : 'tile';
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
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (tileAt(grid, col, row) !== 'no-build') continue;
        drawNoBuildHatch(g, board.x + col * cell, board.y + row * cell, cell);
      }
    }
  }

  private drawRoute(
    routes: readonly (readonly Tile[])[],
    board: { x: number; y: number; cell: number },
    cell: number,
  ): void {
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

function drawTile(g: Graphics, kind: 'buildable' | 'blocked' | 'no-build', px: number, py: number, cell: number): void {
  if (kind === 'blocked') {
    g.rect(px, py, cell, cell).fill(0xa0a0a0);
    edgeRect(g, px, py, cell, 0x707070);
  } else {
    g.rect(px, py, cell, cell).fill(PAL.face);
    hline(g, px, px + cell, py + 0.5, PAL.highlight);
    vline(g, px + 0.5, py, py + cell, PAL.highlight);
    hline(g, px, px + cell, py + cell - 0.5, PAL.shadow);
    vline(g, px + cell - 0.5, py, py + cell, PAL.shadow);
  }
}

/**
 * The No-Build tile's translucent crosshatch: both diagonal families of a 1 px hatch, spacing 4 px,
 * inset 1 px, drawn in the tile pass beneath everything that moves (docs/NO-BUILD-TILE.md §2).
 */
function drawNoBuildHatch(g: Graphics, px: number, py: number, cell: number): void {
  for (const seg of hatchSegments(px + 1, py + 1, cell - 2, 4)) {
    g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha: 0.14 });
  }
}

/**
 * A Minesweeper's mine: a small hatch-ring on its path tile. It is shape-only (a ring plus four
 * short spokes) so it reads in the grey palette, and while armed a faint 1 px ring breathes outward
 * so the player can tell a live field from one that has not armed yet.
 */
function drawMine(
  g: Graphics,
  mine: Mine,
  board: { x: number; y: number; cell: number },
  cell: number,
  clock: number,
): void {
  const cx = board.x + mine.x * cell;
  const cy = board.y + mine.y * cell;
  const armed = clock >= mine.armedAtTick;
  const alpha = armed ? 1 : 0.5;
  const r = cell * 0.16;
  g.circle(cx, cy, r).stroke({ width: 1, color: PAL.dark, alpha });
  const s = r * 0.62;
  g.moveTo(cx - s, cy).lineTo(cx + s, cy);
  g.moveTo(cx, cy - s).lineTo(cx, cy + s);
  g.stroke({ width: 1, color: PAL.dark, alpha });
  if (armed) {
    const pr = r * (1.35 + 0.15 * Math.sin(clock * 0.35));
    g.circle(cx, cy, pr).stroke({ width: 1, color: PAL.dark, alpha: 0.35 });
  }
}

/** Warm colour a shutter's outline drifts toward as it is about to close. */
const SHUTTER_WARM = 0xff6a00;
const SHUTTER_EDGE = 0x707070;

/** Ticks (0.3 s) a shutter plays its transition sequence once before settling on the end frame. */
export const TRANSITION_TICKS = 18;

/** The shutter's frame: a one-shot sequence played across `TRANSITION_TICKS` since the last flip. */
function shutterTexture(name: string, cell: number, transitionAge: number): Texture | null {
  const frames = getArtFrames(name, cell);
  if (frames.length === 0) return null;
  return frames[lifetimeFrame(frames.length, transitionAge, TRANSITION_TICKS)] ?? null;
}

/** Draw one map toggle: a solid shutter when closed, a faint outline plus countdown bar when open. */
function drawShutter(
  g: Graphics,
  tileSprite: Sprite,
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
  // Ticks since the toggle last flipped state. A still or never-cycling shutter stays settled.
  const phase = togglePhase(tg, clock);
  const transitionAge = cycles ? (open ? phase : phase - tg.openTicks) : TRANSITION_TICKS;

  if (open) {
    // The shutter edge stays as a faint outline so the player can read where it will close, warming
    // as the close approaches. The outline asset is white and tinted to the live colour.
    const color = cycles ? lerpColor(SHUTTER_EDGE, SHUTTER_WARM, progress) : SHUTTER_EDGE;
    const tex = shutterTexture('shutter-open', cell, transitionAge);
    if (tex !== null) {
      tileSprite.texture = tex;
      tileSprite.width = cell;
      tileSprite.height = cell;
      tileSprite.position.set(px + cell / 2, py + cell / 2);
      tileSprite.rotation = 0;
      tileSprite.alpha = 0.6;
      tileSprite.tint = color;
      tileSprite.visible = true;
    } else {
      tileSprite.visible = false;
      g.rect(px + 0.5, py + 0.5, cell - 1, cell - 1).stroke({ width: 1, color, alpha: 0.6 });
    }
  } else {
    const tex = shutterTexture('shutter-closed', cell, transitionAge);
    if (tex !== null) {
      tileSprite.texture = tex;
      tileSprite.width = cell;
      tileSprite.height = cell;
      tileSprite.position.set(px + cell / 2, py + cell / 2);
      tileSprite.rotation = 0;
      tileSprite.alpha = 1;
      tileSprite.tint = 0xffffff;
      tileSprite.visible = true;
    } else {
      tileSprite.visible = false;
      g.rect(px, py, cell, cell).fill(0xa0a0a0);
      edgeRect(g, px, py, cell, 0x707070);
    }
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

/** Synergy edges (docs/SYNERGIES.md §5): amber dashed lines, trimmed off the tower art, pulsing. */
/** The opacity of the drawn indicator. Raised from 0.38: it read as a smudge on a busy board. */
const SYNERGY_ALPHA = 0.95;
const SYNERGY_ALPHA_LEAN = 0.9;
const SYNERGY_PULSE = 0.1;
/** Diameter of the halo under a clustered tower, in cells. Bigger than a base, so it spills out. */
const SYNERGY_HALO_CELLS = 1.6;
const SYNERGY_HALO_ALPHA = 1;
/** The link is taller than the old 2 px line so its shape reads at a glance. */
const SYNERGY_LINK_HEIGHT = 0.5;
const SYNERGY_LINK_ALPHA = 1;
/** The link tucks a little under each base, so no daylight shows at the ends. */
const SYNERGY_LINK_OVERLAP = 0.3;
/** The link texture is rasterised smaller than the halo; it is drawn stretched along the edge. */
const SYNERGY_LINK_TEXTURE_SCALE = 0.55;
const SYNERGY_PULSE_HZ = 1.1;
const SYNERGY_WIDTH = 2;
const SYNERGY_TRIM = 0.34;
/** The catalogue's dash cycle, used for the pulse timing. */
function edgePeriod(): number {
  const row = SYNERGIES[0];
  return row.dash + row.gap;
}

/** Dash drift speed in pixels per tick, so the pattern moves leader -> follower over time. */
const SYNERGY_DRIFT = 0.25;

/** The trimmed world-space endpoints of a synergy edge, for drawing and for the RTL identity check. */
export function synergyEdgeEndpoints(
  edge: SynergyEdge,
  board: { x: number; y: number; cell: number },
  cell: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const ax = board.x + (edge.lead.col + 0.5) * cell;
  const ay = board.y + (edge.lead.row + 0.5) * cell;
  const bx = board.x + (edge.follow.col + 0.5) * cell;
  const by = board.y + (edge.follow.row + 0.5) * cell;
  const trim = SYNERGY_TRIM * cell;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return { x0: ax + ux * trim, y0: ay + uy * trim, x1: bx - ux * trim, y1: by - uy * trim };
}

/** The line's alpha and dash offset for a tick. `lean` is flat (no pulse, no drift); `full` pulses. */
export function synergyEdgeStyle(clock: number, quality: QualityLevel, period: number): { alpha: number; offset: number } {
  const alpha =
    quality === 'lean'
      ? SYNERGY_ALPHA_LEAN
      : SYNERGY_ALPHA + SYNERGY_PULSE * Math.sin((clock * SYNERGY_PULSE_HZ * Math.PI * 2) / TICK_HZ);
  const offset = quality === 'lean' ? 0 : ((clock * SYNERGY_DRIFT) % period + period) % period;
  return { alpha, offset };
}

function drawSynergyEdge(
  g: Graphics,
  edge: SynergyEdge,
  board: { x: number; y: number; cell: number },
  cell: number,
  clock: number,
  quality: QualityLevel,
): void {
  const { x0, y0, x1, y1 } = synergyEdgeEndpoints(edge, board, cell);
  const period = edge.dash + edge.gap;
  const { alpha, offset } = synergyEdgeStyle(clock, quality, period);

  const half = SYNERGY_WIDTH / 2;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const lx = (x1 - x0) / length;
  const ly = (y1 - y0) / length;
  for (let d = -offset; d < length; d += period) {
    const start = Math.max(0, d);
    const end = Math.min(length, d + edge.dash);
    if (end <= start) continue;
    const sx = x0 + lx * start;
    const sy = y0 + ly * start;
    if (lx === 0) {
      const x = Math.round(sx);
      const y = Math.round(sy);
      g.rect(x - half, y, SYNERGY_WIDTH, end - start).fill({ color: edge.color, alpha });
    } else {
      const x = Math.round(sx);
      const y = Math.round(sy);
      g.rect(x, y - half, end - start, SYNERGY_WIDTH).fill({ color: edge.color, alpha });
    }
  }
}

/** The mark's half-size in cells — small enough to sit inside the gap between adjacent bases. */
const SYNERGY_MARK_R = 0.3;
const SYNERGY_MARK_WIDTH = 1.5;

/**
 * Draw a synergy's mark at the link midpoint with `Graphics` (docs/SYNERGIES-BATCH-2.md §0). The
 * marks carry the shape signal that lets four more rows read without four more SVGs: `snow` is three
 * crossed strokes, `bolt` a zigzag, `crack` two angled strokes, and `brace` a double chevron.
 */
function drawSynergyMark(
  g: Graphics,
  mark: 'snow' | 'bolt' | 'crack' | 'brace',
  cx: number,
  cy: number,
  color: number,
  alpha: number,
  cell: number,
): void {
  const r = cell * SYNERGY_MARK_R;
  const stroke = (x0: number, y0: number, x1: number, y1: number): void => {
    g.moveTo(cx + x0, cy + y0).lineTo(cx + x1, cy + y1).stroke({ width: SYNERGY_MARK_WIDTH, color, alpha });
  };
  switch (mark) {
    case 'snow':
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        stroke(Math.cos(a) * r, Math.sin(a) * r, -Math.cos(a) * r, -Math.sin(a) * r);
      }
      break;
    case 'bolt': {
      const pts = [-0.45 * r, -r, 0.35 * r, -0.1 * r, -0.35 * r, 0.1 * r, 0.45 * r, r];
      g.moveTo(cx + pts[0], cy + pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(cx + pts[i], cy + pts[i + 1]);
      g.stroke({ width: SYNERGY_MARK_WIDTH, color, alpha });
      break;
    }
    case 'crack':
      stroke(-r, -0.6 * r, 0.2 * r, 0.3 * r);
      stroke(0.2 * r, 0.3 * r, -0.4 * r, 0.9 * r);
      break;
    case 'brace':
      for (const dx of [-0.4 * r, 0.1 * r]) {
        g.moveTo(cx + dx, cy - r).lineTo(cx + dx + 0.5 * r, cy).lineTo(cx + dx, cy + r).stroke({ width: SYNERGY_MARK_WIDTH, color, alpha });
      }
      break;
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

/** A 1px dotted line: 2px on, 3px off. Ties a drifting sprite to the thing it belongs to. */
function dottedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const step = 5;
  for (let d = 0; d < len; d += step) {
    const t0 = d / len;
    const t1 = Math.min(1, (d + 2) / len);
    g.moveTo(x1 + dx * t0, y1 + dy * t0).lineTo(x1 + dx * t1, y1 + dy * t1);
  }
  g.stroke({ width: 1, color });
}

/**
 * Mortar recoil (docs/MORTAR-RECOIL.md). A Cannon on branch A kicks its turret when it fires: the
 * turret sprite alone, not the camera, not the board, not the enemy. Presentation-only — nothing is
 * added to the sim, no event changes, no save field, no rng.
 */

/** Ticks the turret shakes after a Mortar shot (about 160 ms). */
export const RECOIL_DURATION_TICKS = 10;
/** Peak turret displacement as a fraction of a cell (about 1.5 px at a 44 px cell). */
export const RECOIL_PEAK_CELLS = 0.035;

/**
 * The turret's recoil offset for a shot that fired at `fireTick`, in pixels. Zero before the shot
 * and from age 10 on. The envelope decays linearly from 1 at the firing tick to 0 at the last tick;
 * two incommensurate sinusoids make it read as a shake, and no rng is used so a replay is identical.
 */
export function recoilOffset(fireTick: number, clock: number, cell: number): { dx: number; dy: number } {
  const k = clock - fireTick;
  if (k < 0 || k >= RECOIL_DURATION_TICKS) return { dx: 0, dy: 0 };
  const d = 1 - k / RECOIL_DURATION_TICKS;
  const a = RECOIL_PEAK_CELLS * cell;
  return { dx: a * d * Math.sin(2.4 * k), dy: a * d * 0.6 * Math.cos(3.1 * k) };
}

export function drawTower(
  baseSprite: Sprite,
  turretSprite: Sprite,
  markSprite: Sprite,
  wrenchSprite: Sprite,
  g: Graphics,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
  clock: number,
  overlayA: Sprite | null = null,
  overlayB: Sprite | null = null,
  quality: QualityLevel = 'full',
  recoilFireTick: number | null = null,
): void {
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  // These sprites are pooled by tower slot, so each one still carries the look of whichever tower
  // held the slot last frame. Clear the slot before drawing: a wall takes no turret, mark or wrench,
  // and leaving the previous tower's turret lit is how frozen barrels survived their tower.
  clearTowerSprites([turretSprite, markSprite, wrenchSprite]);
  if (t.kind === 'wall') {
    const repairing = isRepairing(t, clock);
    drawWallTower(baseSprite, overlayA, overlayB, g, { ...t, locked: isGateLocked(t, clock), repairing }, cx, cy, cell);
    if (repairing) {
      // A repair replaces the health bar with a progress bar: how far the job has to run.
      drawBar(g, cx, cy, cell, repairProgress(t, clock), REPAIR_COLOR);
    } else if (t.maxHp > 0 && t.hp < t.maxHp) {
      drawBar(g, cx, cy, cell, t.hp / t.maxHp, healthColor(t.hp / t.maxHp));
    }
  } else {
    drawTowerBody(baseSprite, turretSprite, markSprite, g, t, cx, cy, cell, clock);
    // A pooled wrench sprite keeps `visible` from the last tower that used it, so it must be reset
    // every frame: without this the red X stays on a tower after it has been repaired.
    wrenchSprite.visible = false;
    if (isRepairing(t, clock)) {
      drawBar(g, cx, cy, cell, repairProgress(t, clock), REPAIR_COLOR);
    } else if (isEmpDisabled(t, clock)) {
      // EMP'd, not broken: the tower keeps its hit points (and its health bar, when damaged) and
      // draws an amber bolt instead of the red wrench — it returns on its own, no repair needed.
      if (t.maxHp > 0 && t.hp < t.maxHp) drawBar(g, cx, cy, cell, t.hp / t.maxHp, healthColor(t.hp / t.maxHp));
      drawEmpTag(g, cx, cy, cell);
    } else if (isOffline(t)) {
      // Broken-but-fixable, not gone: an empty health bar, a desaturating wash, and a red tag.
      drawBar(g, cx, cy, cell, 0, healthColor(0));
      drawOfflineTag(g, wrenchSprite, cx, cy, cell, quality === 'lean');
    } else if (t.maxHp > 0 && t.hp < t.maxHp) {
      drawBar(g, cx, cy, cell, t.hp / t.maxHp, healthColor(t.hp / t.maxHp));
    }
  }

  if (isFullyUpgraded(t)) {
    const r = pipRect(cx, cy, cell, pipUsesBottomCorner(t, clock));
    drawPip(g, r);
  }

  // A Mortar shot shakes the turret alone, on top of the position drawTowerBody set above. The plinth,
  // branch mark, health bar and finished-upgrade pip stay put. `lean` already drops per-tower
  // decoration, so the recoil is skipped there too.
  if (recoilFireTick !== null && quality !== 'lean') {
    const off = recoilOffset(recoilFireTick, clock, cell);
    turretSprite.position.x += off.dx;
    turretSprite.position.y += off.dy;
  }
}

/**
 * Hide the pooled per-tower sprites a tower slot owns before the slot is redrawn.
 *
 * The pools are indexed by tower slot, not by tower id, so a slot passes from tower to tower as the
 * roster changes. Anything the new tenant does not draw keeps the previous tenant's texture, alpha
 * and position — a sold gun's barrel sitting on a wall, a repaired tower's wrench, a branch mark on
 * a tower that never branched. Clearing first makes every branch responsible only for turning its
 * own sprites on.
 */
export function clearTowerSprites(sprites: readonly { visible: boolean }[]): void {
  for (const s of sprites) s.visible = false;
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
  clock: number,
): void {
  // Base and turret share one clock and seed so a two-part animation stays in step; the clock counts
  // from placement so a `hold` waits from the moment the tower was placed.
  const animTicks = clock - t.placedTick;
  const baseName = artNameForTowerBase(t.kind);
  const baseTex = baseName !== null ? frameTexture(baseName, cell, animTicks, t.id) : null;
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
  const turretTex = turretName !== null ? frameTexture(turretName, cell, animTicks, t.id) : null;
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

/** Draw a wall as a tinted face sprite plus the procedural button bevel, with overlay sprites on top. */
function drawWallTower(
  baseSprite: Sprite,
  overlayA: Sprite | null,
  overlayB: Sprite | null,
  g: Graphics,
  wall: WallState,
  cx: number,
  cy: number,
  cell: number,
): void {
  const size = wallFootprintSize(cell);
  const art = wallArt(wall);
  const faceTex = getArtTexture(art.face, size);
  if (faceTex !== null) {
    drawWallArt(baseSprite, overlayA, overlayB, g, wall, cx, cy, cell, 1);
  } else {
    baseSprite.visible = false;
    if (overlayA) overlayA.visible = false;
    if (overlayB) overlayB.visible = false;
    drawWallShape(g, wall, cx, cy, cell, 1);
  }
}

/**
 * The art path for a wall: a tinted face plate (sprite) under the procedural outline and bevel, with
 * the branch mark, damage stage and repair hatch drawn as overlay sprites when their art is present
 * and falling back to the procedural strokes when a single overlay is missing. The face is the wall's
 * tier plate (`wall-t1`..`wall-t5`), tinted to the live button grey exactly as the old white template.
 */
function drawWallArt(
  baseSprite: Sprite,
  overlayA: Sprite | null,
  overlayB: Sprite | null,
  g: Graphics,
  wall: WallState,
  cx: number,
  cy: number,
  cell: number,
  alpha: number,
): void {
  const spec = wallButtonSpec(wall);
  const art = wallArt(wall);
  const size = wallFootprintSize(cell);
  const x = Math.round(cx - size / 2);
  const y = Math.round(cy - size / 2);
  const s = Math.round(size);

  // The face plate: a light tier template tinted to the button's raised/disabled/pressed grey.
  const faceTex = getArtTexture(art.face, size);
  if (faceTex !== null) {
    baseSprite.texture = faceTex;
    baseSprite.visible = true;
    baseSprite.position.set(cx, cy);
    baseSprite.width = size;
    baseSprite.height = size;
    baseSprite.tint = spec.face;
    baseSprite.rotation = 0;
    baseSprite.alpha = alpha;
  } else {
    baseSprite.visible = false;
  }

  // The outline and bevel stay procedural: they are the button's runtime chrome.
  g.rect(x + 0.5, y + 0.5, s - 1, s - 1).stroke({ width: 1, color: WALL_OUTLINE, alpha });
  wallBevel(g, x + 1, y + 1, s - 2, spec.tl, spec.br, alpha);

  // Branch mark, damage stage and repair hatch: a sprite when the artist has shipped it, the old
  // procedural strokes when not (the damage stage has no additive fallback; the health bar covers it).
  const sprites = [overlayA, overlayB];
  let si = 0;
  for (const name of art.overlays) {
    const tex = getArtTexture(name, size);
    const sprite = sprites[si];
    if (tex !== null && sprite) {
      sprite.texture = tex;
      sprite.visible = true;
      sprite.position.set(cx, cy);
      sprite.width = size;
      sprite.height = size;
      sprite.tint = 0xffffff;
      sprite.rotation = 0;
      sprite.alpha = alpha;
    } else {
      if (sprite) sprite.visible = false;
      drawWallOverlayFallback(g, name, x, y, s, alpha);
    }
    si++;
  }
  for (; si < sprites.length; si++) {
    const sprite = sprites[si];
    if (sprite) sprite.visible = false;
  }
}

/** The procedural detail that backs a wall overlay when its art file is missing. */
function drawWallOverlayFallback(g: Graphics, name: string, x: number, y: number, s: number, alpha: number): void {
  if (name === 'wall-bulwark') {
    wallBevel(g, x + 4, y + 4, s - 8, RAISED_TL, RAISED_BR, alpha);
  } else if (name === 'wall-mesh') {
    for (const seg of hatchSegments(x + 3, y + 3, s - 6, 4)) {
      g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha });
    }
  } else if (name === 'wall-repairing') {
    for (const seg of repairHatch(x + 1, y + 1, s - 2, 4)) {
      g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha });
    }
  }
}

/**
 * Draw the placement ghost at 50% alpha: the same SVG base and turret sprites a fresh tower of
 * `kind` would use, facing north (angle 0) with no branch. A missing texture falls back to the
 * procedural shape so a half-finished art pass degrades like the rest of the pipeline.
 */
function drawGhost(
  baseSprite: Sprite,
  turretSprite: Sprite,
  g: Graphics,
  kind: TowerKind,
  cx: number,
  cy: number,
  cell: number,
): void {
  if (kind === 'wall') {
    const wall = { branch: null, open: false, hp: 1, maxHp: 1, locked: false };
    const spec = wallButtonSpec(wall);
    const art = wallArt(wall);
    const size = wallFootprintSize(cell);
    const faceTex = getArtTexture(art.face, size);
    if (faceTex !== null) {
      baseSprite.texture = faceTex;
      baseSprite.visible = true;
      baseSprite.position.set(cx, cy);
      baseSprite.width = size;
      baseSprite.height = size;
      baseSprite.tint = spec.face;
      baseSprite.rotation = 0;
      baseSprite.alpha = 0.5;
      drawWallFaceDetails(g, spec, cx, cy, cell, 0.5);
    } else {
      baseSprite.visible = false;
      drawWallShape(g, wall, cx, cy, cell, 0.5);
    }
    turretSprite.visible = false;
    return;
  }

  const baseName = artNameForTowerBase(kind);
  const baseTex = baseName !== null ? getArtTexture(baseName, cell) : null;
  if (baseTex === null) {
    baseSprite.visible = false;
    turretSprite.visible = false;
    drawTowerShape(g, kind, cx, cy, cell, 0.5, 0, null);
    return;
  }

  baseSprite.texture = baseTex;
  baseSprite.visible = true;
  baseSprite.position.set(cx, cy);
  baseSprite.width = cell;
  baseSprite.height = cell;
  baseSprite.tint = 0xffffff;
  baseSprite.rotation = 0;
  baseSprite.alpha = 0.5;

  const turretName = artNameForTowerTurret(kind);
  const turretTex = turretName !== null ? getArtTexture(turretName, cell) : null;
  if (turretTex !== null) {
    turretSprite.texture = turretTex;
    turretSprite.visible = true;
    turretSprite.position.set(cx, cy);
    turretSprite.width = cell;
    turretSprite.height = cell;
    turretSprite.tint = 0xffffff;
    turretSprite.rotation = 0;
    turretSprite.alpha = 0.5;
  } else {
    turretSprite.visible = false;
  }
}

/**
 * Where a Cursor tower's range ring belongs: round the cursor the tower owns, not round the tower.
 * The cursor is what actually clicks, and it wanders up to `cursorRadius` from its home tile, so a
 * ring drawn on the tower would describe a shot it cannot take.
 */
export function cursorRingCentre(
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
): { x: number; y: number } {
  return { x: board.x + t.cursorX * cell, y: board.y + t.cursorY * cell };
}

/** Where a Cursor tower's range ring is centred: the tower's own base tile. */
export function cursorLeashCentre(
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
): { x: number; y: number } {
  return { x: board.x + (t.col + 0.5) * cell, y: board.y + (t.row + 0.5) * cell };
}

function drawTowerRange(
  g: Graphics,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
  state: RunState,
): void {
  const cx = board.x + (t.col + 0.5) * cell;
  const cy = board.y + (t.row + 0.5) * cell;
  if (t.kind === 'cursor') {
    // The ring is the leash: how far this tower's cursor may wander from its base. The tether shows
    // where the cursor is on that leash right now, so the pair reads as one tower, not two.
    const home = cursorLeashCentre(t, board, cell);
    const c = cursorRingCentre(t, board, cell);
    dashedCircle(g, home.x, home.y, cursorRadius(t) * cell, PAL.navy, 1);
    dottedLine(g, home.x, home.y, c.x, c.y, PAL.navy);
    return;
  }
  if (t.kind === 'repair') {
    dashedCircle(g, cx, cy, repairRadius(t) * cell, PAL.navy, 1);
    return;
  }
  const st = effectiveStats(t);
  dashedCircle(g, cx, cy, effectiveRange(state, t, st) * cell, PAL.navy, 1);
  if (t.kind === 'beacon') dashedCircle(g, cx, cy, st.range * towerRangeMult(state) * cell, AURA_COLOR, 1);
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
/** The arrow's drawn size, in pixels: the same as the player's pointer. */
export const CURSOR_ARROW_PX = 16;

function drawFlyingCursor(
  g: Graphics,
  arrowSprite: Sprite,
  t: Tower,
  board: { x: number; y: number; cell: number },
  cell: number,
): { texture: Texture; x: number; y: number; size: number; alpha: number } | null {
  const px = board.x + t.cursorX * board.cell;
  const py = board.y + t.cursorY * board.cell;
  const dip = t.cursorClickFx === 8 ? 2 : 0;
  // A tower's cursor is the same size as the player's — it is the same piece of software, and a
  // miniature arrow reads as decoration rather than as a thing that clicks.
  const tex = getArtTexture('cursor-arrow', CURSOR_ARROW_PX);
  if (tex !== null) {
    arrowSprite.texture = tex;
    arrowSprite.width = CURSOR_ARROW_PX;
    arrowSprite.height = CURSOR_ARROW_PX;
    arrowSprite.position.set(px, py + dip);
    arrowSprite.rotation = 0;
    arrowSprite.alpha = 1;
    arrowSprite.tint = 0xffffff;
    arrowSprite.visible = true;
  } else {
    arrowSprite.visible = false;
    drawCursorArrow(g, px, py + dip, CURSOR_ARROW_PX);
  }
  // The click's fire effect: the cursor's own file when it exists, the old white ring otherwise.
  if (t.cursorClickFx > 0) {
    const rx = board.x + t.cursorClickX * board.cell;
    const ry = board.y + t.cursorClickY * board.cell;
    const mark = artNameForBranch('cursor', t.branch);
    const name = mark === null ? 'muzzle-cursor' : `muzzle-${mark}`;
    const tex = getArtTexture(name, Math.round(cell * 0.5)) ?? getArtTexture('muzzle-cursor', Math.round(cell * 0.5));
    if (tex !== null) {
      return {
        texture: tex,
        x: rx,
        y: ry,
        size: cell * 0.5,
        alpha: Math.max(0, t.cursorClickFx / 8),
      };
    }
    g.circle(rx, ry, 6).stroke({ width: 1, color: PAL.highlight });
  }
  return null;
}

/** Draw in-flight projectiles as vector shapes: a shell is a small square, a missile a tapered dart. */
function drawProjectiles(
  g: Graphics,
  spriteAt: (index: number) => Sprite,
  pool: Sprite[],
  state: RunState,
  board: { x: number; y: number; cell: number },
): void {
  if (state.projectiles.length === 0) {
    for (const s of pool) s.visible = false;
    return;
  }
  const cell = board.cell;
  let artIndex = 0;
  for (const p of state.projectiles) {
    const px = board.x + p.x * cell;
    const py = board.y + p.y * cell;
    const heading = Math.atan2(p.vy, p.vx);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    // The SVGs are drawn nose-up, so the sprite's rotation is the heading plus a quarter turn.
    // A Cannon shell is heavier and drawn larger than a Flak shell (0.22 vs 0.16 of a cell).
    let size = Math.round(cell * 0.5);
    if (p.kind === 'shell') {
      const tower = state.towers.find((t) => t.id === p.towerId);
      size = Math.round(cell * (tower !== undefined && tower.kind === 'cannon' ? 0.22 : 0.16));
    }
    // A projectile carries no spawn tick, so it animates on the run clock; its id spreads the phases.
    const tex = frameTexture(p.kind, size, state.clock, p.id);
    if (tex !== null) {
      const spr = spriteAt(artIndex++);
      spr.texture = tex;
      spr.width = size;
      spr.height = size;
      spr.position.set(px, py);
      spr.rotation = heading + Math.PI / 2;
      continue;
    }
    if (p.kind === 'shell') {
      const s = Math.max(2, Math.round(cell * 0.12));
      g.rect(Math.round(px - s / 2), Math.round(py - s / 2), s, s).fill(0x2a2a2a).stroke({ width: 1, color: 0x0a0a0a });
    } else {
      const len = Math.max(4, Math.round(cell * 0.3));
      const half = Math.max(2, Math.round(cell * 0.08));
      const tipX = px + cos * len;
      const tipY = py + sin * len;
      const bx = px - cos * len * 0.4;
      const by = py - sin * len * 0.4;
      g.poly([
        tipX, tipY,
        bx + (-sin) * half, by + (cos) * half,
        bx - (-sin) * half, by - (cos) * half,
      ]).fill(0x2a2a2a).stroke({ width: 1, color: 0x0a0a0a });
      // A short fading trail behind the dart.
      const tx = px - cos * len * 0.6;
      const ty = py - sin * len * 0.6;
      g.moveTo(tx, ty).lineTo(px, py).stroke({ width: 1, color: 0x0a0a0a, alpha: 0.6 });
    }
  }
  for (let i = artIndex; i < pool.length; i++) pool[i].visible = false;
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
  } else if (kind === 'aa') {
    // Anti-air: a square plinth with two thin barrels side by side, tracking the target together.
    const s = Math.round(cell * 0.44);
    const bx = Math.round(cx - s / 2);
    const by = Math.round(cy - s / 2);
    g.rect(bx, by, s, s).fill(fill).stroke(outline);
    const bw = Math.max(2, Math.round(cell * 0.1));
    const bl = Math.round(cell * 0.34);
    const gap = Math.max(1, Math.round(cell * 0.08));
    drawBarrel(g, cx, cy, angle, Math.round(cx - gap - bw), by - bl, bw, bl, fill, outline);
    drawBarrel(g, cx, cy, angle, Math.round(cx + gap), by - bl, bw, bl, fill, outline);
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

function drawEnemy(
  sprite: Sprite,
  bodies: Graphics,
  fx: Graphics,
  e: Enemy,
  board: { x: number; y: number; cell: number },
  cell: number,
  alpha: number,
  slowed: boolean,
  now: number,
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

  // Body: the SVG sprite (one or more frames) when the asset has loaded, otherwise the procedural
  // shape (the temporary fallback that keeps a half-finished art pass rendering; deleted once parity
  // is confirmed). A still is a one-frame sequence, so this path is identical to the pre-animation
  // draw; an animated asset picks its frame from the animator on top of the same texture swap. A boss
  // variant draws its own asset against its scaled radius, falling back to its base type's.
  const bodyPx = artSpriteSize(ENEMY_ART_BODY[e.kind] * r);
  const moving = e.attackTowerId === null && now >= e.stunUntilTick;
  const tex = frameTextureFor(enemyArtNames(e.kind), bodyPx, now - e.spawnTick, e.id, moving);
  if (tex !== null) {
    sprite.texture = tex;
    sprite.visible = true;
    sprite.position.set(ex, ey);
    sprite.width = bodyPx;
    sprite.height = bodyPx;
    sprite.rotation = ENEMY_ART_ROTATES.has(e.kind) ? e.heading : 0;
    sprite.alpha = 1;
    // No ellipse here: a sprite-backed body casts a real silhouette shadow (BoardView.shadows).
  } else {
    sprite.visible = false;
    // The procedural fallback has no texture to cast; the flyer shape keeps its faint ellipse.
    drawEnemyShape(bodies, baseEnemyKind(e.kind), ex, ey, r, color, e.heading);
  }

  // Every boss's own art carries its crown, and the Ram's carries its drill. These runtime stand-ins
  // are drawn only when a boss is falling back to its base type's art (its own file missing or not
  // yet decoded), so the boss still reads as one and the Ram's threat is still telegraphed.
  const ownArt = hasArt(e.kind);
  if (isBossVariant(e.kind) && !ownArt) drawBossCrown(fx, ex, ey, r);
  if (e.kind === 'breacher-boss' && !ownArt) drawRamDrill(fx, ex, ey, r, e.heading);

  // The shield ring: a Bastion draws one ring per remaining layer; everything else draws the single
  // shield ring whose alpha tracks the fraction left.
  if (e.shieldsRemaining > 0) {
    for (let i = 0; i < e.shieldsRemaining; i++) {
      fx.circle(ex, ey, r + 3 + i * 3).stroke({ width: 2, color: SHIELD_COLOR, alpha: 0.85 });
    }
  } else if (e.shield > 0) {
    const frac = e.maxShield > 0 ? Math.max(0, Math.min(1, e.shield / e.maxShield)) : 0;
    fx.circle(ex, ey, r + 3).stroke({
      width: 2,
      color: SHIELD_COLOR,
      alpha: 0.25 + 0.75 * frac,
    });
  }

  // The Pacer aura reads as a faint ring, drawn beneath the enemy's own markings.
  if (e.kind === 'runner-boss') drawPacerAura(fx, ex, ey, cell);

  // The Wirecutter's EMP radius reads as a faint amber ring, telegraphing what it is about to knock out.
  if (e.kind === 'saboteur-boss') drawEmpAura(fx, ex, ey, cell);

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
  } else if (enemyHealthBarVisible(e)) {
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

/** A crown/notch tick at the top of a boss-variant silhouette, the runtime "boss" motif. */
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

/** The Wirecutter's EMP radius: a faint amber ring, so its tower-knockout threat is telegraphed. */
function drawEmpAura(g: Graphics, x: number, y: number, cell: number): void {
  const radius = WIRECUTTER_EMP_RADIUS * cell;
  g.circle(x, y, radius).stroke({ width: 1, color: PAL.amber, alpha: 0.3 });
}

/** The Ram's drill nose: a cone ahead of the leading edge, reading as a weapon aimed at the maze. */
function drawRamDrill(g: Graphics, x: number, y: number, r: number, heading: number): void {
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const tip = r * 1.9;
  const halfW = r * 0.35;
  const px = -sin;
  const py = cos;
  const bx = x + cos * r * 1.1;
  const by = y + sin * r * 1.1;
  g.poly([
    x + cos * tip, y + sin * tip,
    bx + px * halfW, by + py * halfW,
    bx - px * halfW, by - py * halfW,
  ]).fill({ color: PAL.dark }).stroke({ width: 1, color: PAL.highlight });
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

/** An EMP'd tower's marking: a small amber lightning bolt in the top-left corner. */
function drawEmpTag(g: Graphics, cx: number, cy: number, cell: number): void {
  const half = cell / 2;
  const x0 = Math.round(cx - half + 3);
  const y0 = Math.round(cy - half + 3);
  const s = Math.max(3, Math.round(cell * 0.16));
  g.poly([
    x0 + s * 0.55, y0,
    x0 + s * 0.15, y0 + s * 0.55,
    x0 + s * 0.4, y0 + s * 0.55,
    x0 + s * 0.05, y0 + s,
    x0 + s * 0.6, y0 + s * 0.4,
    x0 + s * 0.35, y0 + s * 0.4,
    x0 + s * 0.7, y0,
  ]).fill({ color: PAL.amber });
}

/** An offline tower's marking: a desaturating wash over the body plus a small red crossed wrench. */
function drawOfflineTag(g: Graphics, wrenchSprite: Sprite, cx: number, cy: number, cell: number, skipWrench = false): void {
  const half = cell / 2;
  g.rect(cx - half, cy - half, cell, cell).fill({ color: 0x808080, alpha: 0.35 });
  if (skipWrench) return;
  const s = Math.max(3, Math.round(cell * 0.16));
  const x0 = Math.round(cx - half + 3);
  const y0 = Math.round(cy - half + 3);
  const tex = getArtTexture('offline-wrench', s);
  if (tex !== null) {
    wrenchSprite.texture = tex;
    wrenchSprite.width = s;
    wrenchSprite.height = s;
    wrenchSprite.position.set(x0 + s / 2, y0 + s / 2);
    wrenchSprite.rotation = 0;
    wrenchSprite.alpha = 1;
    wrenchSprite.tint = 0xffffff;
    wrenchSprite.visible = true;
  } else {
    wrenchSprite.visible = false;
    g.moveTo(x0, y0).lineTo(x0 + s, y0 + s);
    g.moveTo(x0 + s, y0).lineTo(x0, y0 + s);
    g.stroke({ width: 2, color: 0xd00000 });
  }
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
