import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  bevel,
  drawStatusBar,
  drawWindowChrome,
  dottedLine,
  FONT,
  FONT_SIZE,
  PAL,
  pointInRect,
  TITLE_H,
  type Layout,
  type Rect,
} from './chrome.ts';
import { artNameForEnemy, getArtTexture } from './art.ts';
import { textWidth } from './hud.ts';
import type { Tile } from '../core/grid.ts';
import type { EnemyKind } from '../core/enemies.ts';

/**
 * The main menu: a small application window sitting on a desktop that is still running a game behind
 * it (docs/VISUAL-PASS.md §1). The window is 320 x 380 plus a menubar and a status bar; behind it the
 * client area draws a dotted teal grid, the current map's route dimmed and pulsing, and a handful of
 * drifting creep silhouettes — one of which an occasional pointer clicks and pops.
 *
 * The model is Pixi-free so the smoke harness can assert the layout and the animation purity;
 * `MenuScreenView` draws it, driven by a time value passed in from `main.ts`.
 */

export type MenuButtonId = 'continue' | 'play' | 'daily' | 'editor' | 'records' | 'load';

const BUTTON_W = 240;
const BUTTON_H = 44;
const BUTTON_GAP = 12;

export const MENU_CLIENT_W = 320;
export const MENU_CLIENT_H = 380;
const MENU_MENU_H = 22;
const MENU_STATUS_H = 22;
/** The menu's backdrop tiles are 40 px, the same grid the board draws, seen from further away. */
export const MENU_TILE = 40;

export interface MenuButton {
  id: MenuButtonId;
  label: string;
  rect: Rect;
  /** The shortcut key shown right-aligned, purely cosmetic. */
  shortcut: string;
  /** A disabled button is drawn flat and never hit-tested (the Daily once played). */
  disabled?: boolean;
}

/** The Daily button's label and availability, computed by the caller from the profile. */
export interface MenuDaily {
  label: string;
  disabled: boolean;
}

export interface MenuScreenLayout {
  window: Rect;
  panel: Rect;
  title: Rect;
  buttons: MenuButton[];
}

export interface MenuWindowLayout {
  window: Rect;
  titleBar: Rect;
  menuBar: Rect;
  client: Rect;
  statusBar: Rect;
  wordmark: Rect;
  rule: Rect;
  marquee: Rect;
  close: Rect;
}

/** The centred application window: title bar, menubar, 320 x 380 client and a status bar. */
export function computeMenuWindow(l: Layout): MenuWindowLayout {
  const winW = MENU_CLIENT_W + 4;
  const winH = 2 + TITLE_H + MENU_MENU_H + MENU_CLIENT_H + MENU_STATUS_H + 2;
  const window: Rect = {
    x: l.client.x + Math.floor((l.client.w - winW) / 2),
    y: l.client.y + Math.floor((l.client.h - winH) / 2),
    w: winW,
    h: winH,
  };
  const titleBar: Rect = { x: window.x + 2, y: window.y + 2, w: winW - 4, h: TITLE_H };
  const menuBar: Rect = { x: window.x + 2, y: titleBar.y + titleBar.h, w: winW - 4, h: MENU_MENU_H };
  const client: Rect = { x: window.x + 2, y: menuBar.y + menuBar.h, w: MENU_CLIENT_W, h: MENU_CLIENT_H };
  const statusBar: Rect = { x: window.x + 2, y: client.y + client.h, w: winW - 4, h: MENU_STATUS_H };
  const wordmark: Rect = { x: client.x, y: client.y + 2, w: MENU_CLIENT_W, h: 30 };
  const rule: Rect = { x: client.x + 10, y: client.y + 32, w: MENU_CLIENT_W - 20, h: 3 };
  const marquee: Rect = { x: client.x + 10, y: client.y + 37, w: MENU_CLIENT_W - 20, h: 18 };
  const close: Rect = {
    x: titleBar.x + titleBar.w - 2 - 16,
    y: titleBar.y + Math.floor((TITLE_H - 14) / 2),
    w: 16,
    h: 14,
  };
  return { window, titleBar, menuBar, client, statusBar, wordmark, rule, marquee, close };
}

export function computeMenuScreen(l: Layout, continueLabel: string | null = null, daily: MenuDaily | null = null): MenuScreenLayout {
  const win = computeMenuWindow(l);
  const labels: [MenuButtonId, string, string][] = [];
  if (continueLabel !== null) labels.push(['continue', continueLabel, 'C']);
  labels.push(['play', 'Play', 'Enter'], ['daily', daily?.label ?? 'Daily', 'D'], ['editor', 'Editor', 'E'], ['records', 'Records', 'R'], ['load', 'Load code', 'L']);
  const buttons: MenuButton[] = labels.map(([id, label, shortcut], i) => ({
    id,
    label,
    shortcut,
    rect: {
      x: win.client.x + Math.floor((MENU_CLIENT_W - BUTTON_W) / 2),
      y: win.client.y + 56 + i * (BUTTON_H + BUTTON_GAP),
      w: BUTTON_W,
      h: BUTTON_H,
    },
    ...(id === 'daily' && daily?.disabled ? { disabled: true } : {}),
  }));
  return { window: win.window, panel: win.client, title: win.wordmark, buttons };
}

export function menuButtonAt(l: Layout, px: number, py: number, continueLabel: string | null = null, daily: MenuDaily | null = null): MenuButtonId | null {
  for (const b of computeMenuScreen(l, continueLabel, daily).buttons) {
    if (b.disabled) continue;
    if (pointInRect(b.rect, px, py)) return b.id;
  }
  return null;
}

/** Whether a point lands on the menu window's close box (which does nothing but a soft beep). */
export function menuWindowCloseAt(l: Layout, px: number, py: number): boolean {
  return pointInRect(computeMenuWindow(l).close, px, py);
}

/** The menubar word under a point, for the click-flash. */
export function menuBarWordAt(l: Layout, px: number, py: number): 'file' | 'view' | 'help' | null {
  const win = computeMenuWindow(l);
  if (!pointInRect(win.menuBar, px, py)) return null;
  const x = px - (win.menuBar.x + 6);
  if (x < 0) return null;
  const idx = Math.floor(x / (7 * 4 + 8)); // "File" width + spacing
  return (['file', 'view', 'help'] as const)[Math.min(2, idx)] ?? null;
}

// ---------------------------------------------------------------------------------------------
// The living desktop: pure, time-driven animation state

export interface MenuCreepSpec {
  speed: number;
  phase: number;
  flyer: boolean;
  kind: string;
}

/** Four to six creeps (five here), two of them flyers, with speeds in the 12-20 px/s band. */
export function menuCreepSpecs(): readonly MenuCreepSpec[] {
  return [
    { speed: 12, phase: 0.0, flyer: false, kind: 'grunt' },
    { speed: 14, phase: 0.22, flyer: false, kind: 'runner' },
    { speed: 16, phase: 0.45, flyer: true, kind: 'flyer' },
    { speed: 18, phase: 0.63, flyer: false, kind: 'shielded' },
    { speed: 20, phase: 0.81, flyer: true, kind: 'flyer' },
  ];
}

export interface MenuCreep {
  x: number;
  y: number;
  flyer: boolean;
  kind: string;
  pop: boolean;
}

export interface MenuAnimState {
  creeps: MenuCreep[];
  pointer: { x: number; y: number; visible: boolean; clicking: boolean } | null;
  /** Route alpha, pulsing 0.10 -> 0.18 over 4 s. */
  pulse: number;
  /** The marquee scroll offset in px, right to left at 30 px/s. */
  marqueeOffset: number;
}

function routePoints(route: readonly Tile[]): { x: number; y: number }[] {
  return route.map((t) => ({ x: (t.col + 0.5) * MENU_TILE, y: (t.row + 0.5) * MENU_TILE }));
}

function routeLength(pts: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return total;
}

function pointAlong(pts: readonly { x: number; y: number }[], dist: number): { x: number; y: number } {
  let remaining = dist;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

/**
 * The pure menu animation state at a given wall-clock time: five drifting creeps along the route,
 * an occasional pointer that slides to one and clicks it, the route's pulse, and the marquee offset.
 * Purely a function of `timeSec` and `route`, so two draws at the same time are identical.
 */
export function computeMenuAnim(timeSec: number, route: readonly Tile[]): MenuAnimState {
  const specs = menuCreepSpecs();
  const pts = routePoints(route.length > 0 ? route : [{ col: 0, row: 0 }, { col: 1, row: 0 }]);
  const total = Math.max(1, routeLength(pts));

  const creeps: MenuCreep[] = specs.map((spec) => {
    const dist = ((spec.speed * timeSec + spec.phase * total) % total + total) % total;
    const p = pointAlong(pts, dist);
    let y = p.y;
    if (spec.flyer) y += Math.sin(timeSec * 2 + spec.phase * 10) * 6;
    return { x: p.x, y, flyer: spec.flyer, kind: spec.kind, pop: false };
  });

  const pointerPeriod = 11;
  const pPhase = timeSec % pointerPeriod;
  const clicking = pPhase >= 5 && pPhase < 5.4;
  const targetIndex = Math.floor(timeSec / pointerPeriod) % creeps.length;
  const target = creeps[targetIndex];
  const slideT = Math.min(1, pPhase / 5);
  const pointer = {
    x: target.x - (1 - slideT) * 200,
    y: target.y - (1 - slideT) * 80,
    visible: true,
    clicking,
  };
  if (clicking) creeps[targetIndex].pop = true;

  const pulse = 0.14 + 0.04 * Math.sin(((timeSec % 4) / 4) * Math.PI * 2);

  return { creeps, pointer, pulse, marqueeOffset: timeSec * 30 };
}

// ---------------------------------------------------------------------------------------------
// Load dialog (unchanged)

const DLG_W = 460;
const DLG_TITLE_H = 20;
const DLG_PAD = 12;
const DLG_ROW_H = 20;
const DLG_FIELD_H = 24;
const DLG_BUTTON_W = 84;
const DLG_BUTTON_H = 28;

export interface LoadDialogLayout {
  rect: Rect;
  field: Rect;
  status: Rect;
  ok: Rect;
  cancel: Rect;
}

export function computeLoadDialog(l: Layout): LoadDialogLayout {
  const h = DLG_TITLE_H + DLG_PAD + DLG_ROW_H + DLG_FIELD_H + DLG_ROW_H + DLG_PAD + DLG_BUTTON_H + DLG_PAD;
  const w = Math.min(DLG_W, l.client.w - 40);
  const rect: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const field: Rect = { x: rect.x + DLG_PAD, y: rect.y + DLG_TITLE_H + DLG_PAD + DLG_ROW_H, w: w - DLG_PAD * 2, h: DLG_FIELD_H };
  const status: Rect = { x: rect.x + DLG_PAD, y: field.y + field.h + 2, w: w - DLG_PAD * 2, h: DLG_ROW_H };
  const ok: Rect = { x: rect.x + w - DLG_PAD - DLG_BUTTON_W * 2 - 6, y: rect.y + h - DLG_PAD - DLG_BUTTON_H, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
  const cancel: Rect = { x: ok.x + DLG_BUTTON_W + 6, y: ok.y, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
  return { rect, field, status, ok, cancel };
}

export function loadDialogButtonAt(l: Layout, px: number, py: number): 'ok' | 'cancel' | null {
  const d = computeLoadDialog(l);
  if (pointInRect(d.ok, px, py)) return 'ok';
  if (pointInRect(d.cancel, px, py)) return 'cancel';
  return null;
}

function makeText(text: string, fill: number, bold = false, size: number = FONT_SIZE.body): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

const MARQUEE_TIPS = 'Tip: flyers ignore your maze  ·  Tip: Ctrl+click upgrades a whole row  ·  Tip: the pointer crits on weak points  ·  Tip: Restart Windows keeps your specs  ·  ';

export class MenuScreenView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleBarText: Text;
  private readonly title: Text;
  private readonly menuWordTexts: Text[] = [];
  private readonly marquee: Text;
  private readonly buttonTexts: Text[] = [];
  private readonly shortcutTexts: Text[] = [];
  private readonly statusTexts: Text[] = [];
  private readonly creepLayer = new Container();
  private readonly creepSprites: Sprite[] = [];
  private readonly pointerSprite: Sprite;
  /** Cached route polyline and creep parameters, so a frame allocates nothing. */
  private cachedRouteKey = '';
  private routePts: { x: number; y: number }[] = [];
  private routeOriginX = 0;
  private routeOriginY = 0;
  private creepSpecs: readonly MenuCreepSpec[] = menuCreepSpecs();
  private readonly creepPool: MenuCreep[] = [];

  constructor() {
    this.root.addChild(this.g, this.creepLayer);
    this.titleBarText = makeText('Pointer Defense', PAL.titleInverse, true, FONT_SIZE.body);
    this.titleBarText.anchor.set(0, 0.5);
    this.root.addChild(this.titleBarText);
    this.title = makeText('POINTER DEFENSE', PAL.title, true, 26);
    this.title.anchor.set(0, 0.5);
    this.root.addChild(this.title);

    for (const word of ['File', 'View', 'Help']) {
      const t = makeText(word, PAL.text, false, FONT_SIZE.small);
      t.anchor.set(0, 0.5);
      this.menuWordTexts.push(t);
      this.root.addChild(t);
    }

    this.marquee = makeText('', PAL.text, false, FONT_SIZE.small);
    this.marquee.anchor.set(0, 0.5);
    this.root.addChild(this.marquee);

    for (let i = 0; i < 6; i++) {
      const t = makeText('', PAL.text, true, FONT_SIZE.body);
      t.anchor.set(0, 0.5);
      this.buttonTexts.push(t);
      this.root.addChild(t);
      const s = makeText('', PAL.shadow, false, FONT_SIZE.small);
      s.anchor.set(1, 0.5);
      this.shortcutTexts.push(s);
      this.root.addChild(s);
    }
    for (let i = 0; i < 3; i++) {
      const t = makeText('', PAL.text, false, FONT_SIZE.small);
      t.anchor.set(0, 0.5);
      this.statusTexts.push(t);
      this.root.addChild(t);
    }

    this.pointerSprite = new Sprite();
    this.pointerSprite.anchor.set(0.5, 0.5);
    this.pointerSprite.visible = false;
    this.root.addChild(this.pointerSprite);
  }

  private creepSpriteAt(index: number): Sprite {
    let s = this.creepSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.creepSprites.push(s);
      this.creepLayer.addChild(s);
    }
    s.visible = true;
    return s;
  }

  private ensureRoute(route: readonly Tile[], client: Rect): void {
    const key = route.map((t) => `${t.col},${t.row}`).join(';');
    if (key === this.cachedRouteKey) return;
    this.cachedRouteKey = key;
    this.routePts = routePoints(route.length > 0 ? route : [{ col: 0, row: 0 }, { col: 1, row: 0 }]);
    this.creepSpecs = menuCreepSpecs();
    this.creepPool.length = 0;
    for (const spec of this.creepSpecs) this.creepPool.push({ x: 0, y: 0, flyer: spec.flyer, kind: spec.kind, pop: false });
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of this.routePts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    this.routeOriginX = client.x + Math.floor((client.w - (maxX - minX + MENU_TILE)) / 2) - minX;
    this.routeOriginY = client.y + Math.floor((client.h - (maxY - minY + MENU_TILE)) / 2) - minY;
  }

  draw(l: Layout, hover: MenuButtonId | null, state: {
    continueLabel: string | null;
    daily: MenuDaily | null;
    time: number;
    route: readonly Tile[];
    bestWave: number;
    runs: number;
    achievements: number;
    version: string;
  }): void {
    const g = this.g;
    g.clear();
    const m = computeMenuScreen(l, state.continueLabel, state.daily);
    const win = computeMenuWindow(l);
    const c = l.client;
    const time = state.time;

    // --- Backdrop: the desktop teal with the board's dotted grid.
    g.rect(c.x, c.y, c.w, c.h).fill(PAL.desktop);
    g.rect(c.x, c.y, c.w, c.h).fill({ color: PAL.highlight, alpha: 0.12 });
    for (let gx = c.x; gx < c.x + c.w; gx += MENU_TILE) {
      for (let gy = c.y; gy < c.y + c.h; gy += MENU_TILE) {
        g.rect(gx, gy, 1, 1).fill(PAL.highlight);
      }
    }

    // --- The dimmed, pulsing route.
    this.ensureRoute(state.route, c);
    const anim = computeMenuAnim(time, state.route);
    const alpha = anim.pulse;
    const offX = this.routeOriginX;
    const offY = this.routeOriginY;
    const pts = this.routePts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      dottedLine(g, offX + a.x, offY + a.y, offX + b.x, offY + b.y, PAL.highlight);
    }
    for (const p of pts) {
      const px = offX + p.x;
      const py = offY + p.y;
      g.rect(px - MENU_TILE / 2, py - MENU_TILE / 2, MENU_TILE, MENU_TILE).fill({ color: PAL.highlight, alpha: alpha });
    }

    // --- Drifting creep silhouettes.
    for (let i = 0; i < anim.creeps.length; i++) {
      const creep = anim.creeps[i];
      const pool = this.creepPool[i];
      pool.x = creep.x;
      pool.y = creep.y;
      pool.flyer = creep.flyer;
      pool.kind = creep.kind;
      pool.pop = creep.pop;
      const sx = offX + creep.x;
      const sy = offY + creep.y;
      if (creep.pop) {
        g.rect(sx - 6, sy - 6, 4, 4).fill({ color: PAL.highlight, alpha: 0.5 });
        g.rect(sx + 2, sy - 6, 4, 4).fill({ color: PAL.highlight, alpha: 0.5 });
        g.rect(sx - 6, sy + 2, 4, 4).fill({ color: PAL.highlight, alpha: 0.5 });
        g.rect(sx + 2, sy + 2, 4, 4).fill({ color: PAL.highlight, alpha: 0.5 });
        continue;
      }
      const tex = getArtTexture(artNameForEnemy(creep.kind as EnemyKind) ?? '', 28);
      const spr = this.creepSpriteAt(i);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = 28;
        spr.height = 28;
        spr.position.set(sx, sy);
        spr.rotation = 0;
        spr.alpha = 0.14;
        spr.tint = 0x000000;
      } else {
        spr.visible = false;
        g.rect(sx - 8, sy - 8, 16, 16).fill({ color: PAL.shadow, alpha: 0.14 });
        g.rect(sx - 6, sy - 6, 12, 12).fill({ color: PAL.shadow, alpha: 0.14 });
      }
    }
    for (let i = anim.creeps.length; i < this.creepSprites.length; i++) this.creepSprites[i].visible = false;

    // --- The pointer and its click spark.
    const pointer = anim.pointer;
    if (pointer) {
      const px = offX + pointer.x;
      const py = offY + pointer.y;
      const tex = getArtTexture('cursor-arrow', 16);
      if (tex !== null) {
        this.pointerSprite.texture = tex;
        this.pointerSprite.width = 16;
        this.pointerSprite.height = 16;
        this.pointerSprite.position.set(px, py);
        this.pointerSprite.rotation = 0;
        this.pointerSprite.alpha = 1;
        this.pointerSprite.tint = 0xffffff;
        this.pointerSprite.visible = true;
      } else {
        this.pointerSprite.visible = false;
        g.poly([px, py, px, py + 13, px + 3.5, py + 10, px + 5.5, py + 16, px + 8, py + 14, px + 6.5, py + 10, px + 11, py + 10]).fill(PAL.highlight).stroke({ width: 1, color: PAL.dark });
      }
      if (pointer.clicking) {
        g.rect(px - 3, py - 3, 6, 6).fill(PAL.highlight);
        g.circle(px, py, 3).stroke({ width: 1, color: PAL.highlight });
      }
    } else {
      this.pointerSprite.visible = false;
    }

    // --- The window.
    const chromeGeom = drawWindowChrome(g, win.window, { close: true, minimize: false, maximize: false });
    this.titleBarText.position.set(chromeGeom.titleX, chromeGeom.titleY);
    this.title.text = 'POINTER DEFENSE';
    this.title.position.set(win.client.x + 30, win.wordmark.y + win.wordmark.h / 2);
    // pointer-arrow glyph to the left of the wordmark
    g.poly([win.client.x + 8, win.wordmark.y + 4, win.client.x + 8, win.wordmark.y + 26, win.client.x + 14, win.wordmark.y + 21, win.client.x + 18, win.wordmark.y + 29, win.client.x + 22, win.wordmark.y + 26, win.client.x + 20, win.wordmark.y + 20, win.client.x + 27, win.wordmark.y + 20]).fill(PAL.navy);

    // 2 px navy rule with a 1 px highlight beneath.
    g.rect(win.rule.x, win.rule.y, win.rule.w, 2).fill(PAL.navy);
    g.rect(win.rule.x, win.rule.y + 2, win.rule.w, 1).fill(PAL.highlight);

    // Menubar words.
    g.rect(win.menuBar.x, win.menuBar.y, win.menuBar.w, win.menuBar.h).fill(PAL.face);
    let mwx = win.menuBar.x + 6;
    for (let i = 0; i < this.menuWordTexts.length; i++) {
      const t = this.menuWordTexts[i];
      t.position.set(mwx, win.menuBar.y + Math.floor(win.menuBar.h / 2));
      mwx += t.width + 8;
    }

    // Marquee.
    bevel(g, win.marquee, false, PAL.face);
    const marqueeText = MARQUEE_TIPS;
    const textW = textWidth(marqueeText, FONT_SIZE.small);
    const scrollW = textW + win.marquee.w;
    const off = state.time * 30 % scrollW;
    this.marquee.text = marqueeText;
    this.marquee.position.set(win.marquee.x + win.marquee.w - off, win.marquee.y + Math.floor(win.marquee.h / 2));

    // Buttons.
    for (let i = 0; i < this.buttonTexts.length; i++) {
      const b = m.buttons[i];
      const t = this.buttonTexts[i];
      const s = this.shortcutTexts[i];
      if (!b) {
        t.text = '';
        s.text = '';
        continue;
      }
      const focused = b.id === (m.buttons[0].id === 'continue' ? 'continue' : 'play');
      if (b.disabled) {
        g.rect(b.rect.x, b.rect.y, b.rect.w, b.rect.h).fill(PAL.face);
        g.rect(b.rect.x, b.rect.y, b.rect.w, b.rect.h).stroke({ width: 1, color: PAL.shadow });
        t.style.fill = PAL.shadow;
      } else {
        const hovered = hover === b.id;
        bevel(g, b.rect, true, hovered ? PAL.highlight : PAL.face);
        if (hovered) {
          g.rect(b.rect.x, b.rect.y, b.rect.w, 1).fill(PAL.highlight);
          g.rect(b.rect.x, b.rect.y + b.rect.h - 1, b.rect.w, 1).fill(PAL.slight);
        }
        t.style.fill = PAL.text;
      }
      if (focused && !b.disabled) {
        dottedLine(g, b.rect.x + 3, b.rect.y + 3, b.rect.x + b.rect.w - 3, b.rect.y + 3, PAL.dark);
        dottedLine(g, b.rect.x + b.rect.w - 3, b.rect.y + 3, b.rect.x + b.rect.w - 3, b.rect.y + b.rect.h - 3, PAL.dark);
        dottedLine(g, b.rect.x + b.rect.w - 3, b.rect.y + b.rect.h - 3, b.rect.x + 3, b.rect.y + b.rect.h - 3, PAL.dark);
        dottedLine(g, b.rect.x + 3, b.rect.y + b.rect.h - 3, b.rect.x + 3, b.rect.y + 3, PAL.dark);
      }
      const glyphColor = hover === b.id && !b.disabled ? PAL.navy : PAL.text;
      drawButtonGlyph(g, b.id, b.rect.x + 16, b.rect.y + Math.floor(b.rect.h / 2), glyphColor);
      t.text = b.label;
      t.position.set(b.rect.x + 40, b.rect.y + Math.floor(b.rect.h / 2));
      s.text = b.shortcut;
      s.position.set(b.rect.x + b.rect.w - 12, b.rect.y + Math.floor(b.rect.h / 2));
    }

    // Status bar.
    const panels = drawStatusBar(g, win.statusBar, [120, 0, 60]);
    this.statusTexts[0].text = 'Ready';
    this.statusTexts[0].position.set(panels[0].x + 4, panels[0].y + Math.floor(panels[0].h / 2));
    this.statusTexts[1].text = `Best wave ${state.bestWave} · ${state.runs} runs · ${state.achievements}/118 achievements`;
    this.statusTexts[1].position.set(panels[1].x + 4, panels[1].y + Math.floor(panels[1].h / 2));
    this.statusTexts[2].text = state.version;
    this.statusTexts[2].position.set(panels[2].x + 4, panels[2].y + Math.floor(panels[2].h / 2));
  }
}

function drawButtonGlyph(g: Graphics, id: MenuButtonId, cx: number, cy: number, color: number): void {
  if (id === 'continue' || id === 'play') {
    g.poly([cx - 5, cy - 8, cx - 5, cy + 8, cx + 7, cy]).fill(color);
  } else if (id === 'daily') {
    g.rect(cx - 7, cy - 7, 14, 12).stroke({ width: 1, color });
    g.rect(cx - 7, cy - 7, 14, 3).fill(color);
  } else if (id === 'editor') {
    g.moveTo(cx - 6, cy + 6).lineTo(cx + 4, cy - 4).stroke({ width: 1, color });
    g.moveTo(cx - 6, cy + 6).lineTo(cx - 6, cy + 1).stroke({ width: 1, color });
    g.moveTo(cx - 1, cy + 6).lineTo(cx - 6, cy + 6).stroke({ width: 1, color });
  } else if (id === 'records') {
    g.rect(cx - 7, cy - 7, 14, 4).fill(color);
    g.rect(cx - 7, cy - 2, 14, 4).fill(color);
    g.rect(cx - 7, cy + 3, 14, 4).fill(color);
  } else {
    g.poly([cx - 6, cy - 6, cx + 6, cy - 6, cx, cy + 6]).fill(color);
  }
}

export class LoadDialogView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly field: Text;
  private readonly status: Text;
  private readonly ok: Text;
  private readonly cancel: Text;

  constructor() {
    this.title = makeText('Load code', PAL.titleInverse, true);
    this.field = makeText('', PAL.text);
    this.status = makeText('', PAL.maroon);
    this.ok = makeText('OK', PAL.text);
    this.cancel = makeText('Cancel', PAL.text);
    this.title.anchor.set(0, 0.5);
    this.field.anchor.set(0, 0.5);
    this.status.anchor.set(0, 0.5);
    this.ok.anchor.set(0.5, 0.5);
    this.cancel.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.title, this.field, this.status, this.ok, this.cancel);
  }

  draw(l: Layout, text: string, status: string, hover: 'ok' | 'cancel' | null): void {
    const g = this.g;
    g.clear();
    const d = computeLoadDialog(l);

    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });
    bevel(g, d.rect, true, PAL.face);
    g.rect(d.rect.x + 2, d.rect.y + 2, d.rect.w - 4, DLG_TITLE_H).fill(PAL.title);

    this.title.text = 'Load code';
    this.title.position.set(d.rect.x + 6, d.rect.y + 2 + DLG_TITLE_H / 2);

    bevel(g, d.field, false, PAL.highlight);
    this.field.text = text;
    this.field.position.set(d.field.x + 4, d.field.y + d.field.h / 2);

    this.status.text = status;
    this.status.position.set(d.status.x, d.status.y + d.status.h / 2);

    bevel(g, d.ok, true, hover === 'ok' ? PAL.highlight : PAL.face);
    bevel(g, d.cancel, true, hover === 'cancel' ? PAL.highlight : PAL.face);
    this.ok.text = 'OK';
    this.ok.position.set(d.ok.x + d.ok.w / 2, d.ok.y + d.ok.h / 2);
    this.cancel.text = 'Cancel';
    this.cancel.position.set(d.cancel.x + d.cancel.w / 2, d.cancel.y + d.cancel.h / 2);
  }
}
