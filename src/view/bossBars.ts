import { Container, Graphics, Text } from 'pixi.js';
import { FONT, FONT_SIZE, PAL, type Layout } from './chrome.ts';
import {
  BASTION_SHIELD_LAYERS,
  ENEMY_STATS,
  isBossKind,
  isBossVariant,
  type Enemy,
  type EnemyKind,
} from '../core/enemies.ts';
import type { RunState } from '../core/state.ts';
import { TICK_HZ } from '../core/time.ts';

/**
 * Boss bars: the Minecraft-style announcement across the top of the field. A living boss draws its
 * name, a health bar and — when it has one — a shield bar, stacked up to three deep in spawn order.
 *
 * The geometry is state-driven, so these are runtime chrome, not SVG assets (see docs/design.md).
 * The model (which bosses, their fill, the first-appearance rule) is kept Pixi-free so the smoke
 * harness can assert it headlessly; the view turns that model into Graphics/Text calls.
 */

// --- Layout ----------------------------------------------------------------------------------

// The panel lives in the window's title strip and grows down into the menu strip, never reaching
// the field: nothing it draws sits over a tile.
const PANEL_MAX_W = 460;
const PANEL_PAD = 2; // face border and bevel; the dark interior starts inside it
const ROW_H = 20; // name line, then the shield and health bars
const ROW_GAP = 0; // two rows must fill the 44 px of title plus menu strip exactly
const SHIELD_H = 4;
const HEALTH_H = 5;
const MAX_BARS = 3;
const PANEL_FACE = PAL.face;
const PANEL_WELL = 0x101010;
const GIMMICK_COLOR = 0x9aa0a6;

// --- Timing (fixed 60 Hz ticks, matching the rest of the chrome) ------------------------------

const FADE_IN_TICKS = Math.round(TICK_HZ * 0.15);
const FADE_OUT_TICKS = Math.round(TICK_HZ * 0.6);
const DRAIN_TICKS = Math.round(TICK_HZ * 0.4);
const NEW_TAG_TICKS = Math.round(TICK_HZ * 2.5);
const FLASH_TICKS = Math.round(TICK_HZ * 0.12);

// --- Colours ---------------------------------------------------------------------------------

const HEALTH_FILL = 0xa00000; // deep red
const HEALTH_LAG = 0xff9c9c; // pale "damage lag" segment
const SHIELD_BAR = 0x00d0d0; // cyan, matching the board's shield ring
const SHIELD_DIM = 0x006a8a; // dim outline for empty Bastion segments
const NEW_TAG_COLOR = 0xffcc00;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// ---------------------------------------------------------------------------------------------
// Pure model

/** Living bosses on the field, ordered by spawn time (the monotonic enemy id). */
export function livingBosses(enemies: readonly Enemy[]): Enemy[] {
  const out = enemies.filter((e) => !e.dead && isBossKind(e.kind));
  out.sort((a, b) => a.id - b.id);
  return out;
}

/** The boss's announcement name, uppercase and ready for letter-spacing. */
export function bossName(kind: EnemyKind): string {
  return ENEMY_STATS[kind].name.toUpperCase();
}

/** The one-line gimmick subtitle for a type's first appearance, or null when the kind has none. */
export function bossGimmick(kind: EnemyKind): string | null {
  switch (kind) {
    case 'grunt-boss':
      return 'shrugs off damage';
    case 'runner-boss':
      return 'anything near it keeps pace';
    case 'shielded-boss':
      return 'three layers of shielding';
    case 'flyer-boss':
      return 'hatches flyers as it flies';
    case 'armoured-boss':
      return 'plated and slow to chill';
    case 'saboteur-boss':
      return 'shorts out towers as it passes';
    case 'breacher-boss':
      return 'eats through your towers';
    default:
      return null;
  }
}

export interface BossShield {
  /** 0 = no shield bar, 1 = a single continuous shield, N = N segment slots (a Bastion). */
  segments: number;
  /** Filled segment count for a segmented bar. */
  filled: number;
  /** Fill fraction (0..1) for a single continuous shield. */
  ratio: number;
}

/** The shield bar shape for a boss: segmented per layer for a Bastion, one fill otherwise. */
export function bossShield(e: Enemy): BossShield {
  if (e.kind === 'shielded-boss') {
    const filled = Math.max(0, Math.min(BASTION_SHIELD_LAYERS, e.shieldsRemaining));
    return { segments: BASTION_SHIELD_LAYERS, filled, ratio: filled / BASTION_SHIELD_LAYERS };
  }
  if (e.shield > 0 || e.maxShield > 0) {
    const ratio = e.maxShield > 0 ? clamp01(e.shield / e.maxShield) : 0;
    return { segments: 1, filled: e.shield > 0 ? 1 : 0, ratio };
  }
  return { segments: 0, filled: 0, ratio: 0 };
}

/** The panel width: never wider than 460, and always inside the board column's edges. */
export function bossBarWidth(boardW: number): number {
  return Math.max(1, Math.min(PANEL_MAX_W, boardW - 16));
}

export interface BossBarRect {
  x: number;
  y: number;
  w: number;
  h: number;
  nameY: number;
  shieldY: number;
  healthY: number;
}

/**
 * The panel that holds the boss bars: centred on the field, pinned to the top of the window, and
 * clamped so its bottom edge stops above `client.y` — the field's first row of pixels. It grows
 * from the title strip into the menu strip, which is empty to the right of the menus.
 */
export function bossPanelRect(l: Layout, rows: number): { x: number; y: number; w: number; h: number } {
  const w = bossBarWidth(l.boardW);
  const x = Math.round(l.board.x + l.boardW / 2 - w / 2);
  const y = l.title.y;
  const fits = Math.floor((l.client.y - y - PANEL_PAD * 2 + ROW_GAP) / (ROW_H + ROW_GAP));
  const n = Math.max(1, Math.min(rows, fits, MAX_BARS));
  return { x, y, w, h: PANEL_PAD * 2 + n * ROW_H + (n - 1) * ROW_GAP };
}

/** The geometry of the `index`-th bar row inside a panel rect. */
export function bossRowRect(p: { x: number; y: number; w: number }, index: number): BossBarRect {
  const inset = PANEL_PAD + 4;
  const x = p.x + inset;
  const y = p.y + PANEL_PAD + index * (ROW_H + ROW_GAP);
  const w = p.w - inset * 2;
  // 11 px name line, a 4 px shield bar, a 5 px health bar: 20 px per boss.
  return { x, y, w, h: ROW_H, nameY: y, shieldY: y + 11, healthY: y + 15 };
}

/** The row for the `index`-th boss when up to `MAX_BARS` are showing. */
export function bossBarRect(l: Layout, index: number): BossBarRect {
  return bossRowRect(bossPanelRect(l, MAX_BARS), index);
}

/** The pixel width of a fill at `ratio` inside a bar of `innerW` usable pixels. */
export function barFillPx(innerW: number, ratio: number): number {
  return Math.max(0, Math.round(innerW * clamp01(ratio)));
}

/** One tracked boss bar, its live snapshot and its damage-lag state. */
export interface BossBarTrack {
  enemyId: number;
  kind: EnemyKind;
  name: string;
  bornTick: number;
  /** Tick the boss died or left, or -1 while alive. */
  deadTick: number;
  isNew: boolean;
  gimmick: string | null;
  lag: number;
  draining: boolean;
  drainStart: number;
  drainStartTick: number;
  hp: number;
  maxHp: number;
  shieldSegments: number;
  shieldFilled: number;
  shieldRatio: number;
}

/**
 * Reconcile the tracked bars against the living bosses, marking new ones, recording first
 * appearances into `seen` (returning the newly-added kinds for persistence), starting fades for
 * bosses that left, and advancing the damage-lag. Mutates `tracks` and `seen`.
 */
export function advanceBossBars(
  tracks: BossBarTrack[],
  enemies: readonly Enemy[],
  tick: number,
  seen: Set<EnemyKind>,
  shakeOn: boolean,
): EnemyKind[] {
  const living = livingBosses(enemies);
  const byId = new Map<number, Enemy>();
  for (const e of living) byId.set(e.id, e);

  for (const t of tracks) {
    if (t.deadTick < 0 && !byId.has(t.enemyId)) t.deadTick = tick;
  }

  const newlySeen: EnemyKind[] = [];
  for (const e of living) {
    if (tracks.some((t) => t.enemyId === e.id)) continue;
    const firstAppearance = isBossVariant(e.kind) && !seen.has(e.kind);
    if (firstAppearance) {
      seen.add(e.kind);
      newlySeen.push(e.kind);
    }
    tracks.push({
      enemyId: e.id,
      kind: e.kind,
      name: bossName(e.kind),
      bornTick: tick,
      deadTick: -1,
      isNew: firstAppearance,
      gimmick: firstAppearance ? bossGimmick(e.kind) : null,
      lag: e.maxHp > 0 ? e.hp / e.maxHp : 0,
      draining: false,
      drainStart: 0,
      drainStartTick: 0,
      hp: e.hp,
      maxHp: e.maxHp,
      shieldSegments: 0,
      shieldFilled: 0,
      shieldRatio: 0,
    });
  }

  for (const t of tracks) {
    if (t.deadTick >= 0) continue;
    const e = byId.get(t.enemyId);
    if (!e) continue;
    const shield = bossShield(e);
    t.hp = e.hp;
    t.maxHp = e.maxHp;
    t.shieldSegments = shield.segments;
    t.shieldFilled = shield.filled;
    t.shieldRatio = shield.ratio;
    const target = e.maxHp > 0 ? e.hp / e.maxHp : 0;
    stepLag(t, target, tick, shakeOn);
  }

  for (let i = tracks.length - 1; i >= 0; i--) {
    const t = tracks[i];
    if (t.deadTick >= 0 && tick - t.deadTick >= FADE_OUT_TICKS) tracks.splice(i, 1);
  }

  return newlySeen;
}

/** Advance the damage-lag: a big hit drains to the true value over ~400 ms, unless motion is off. */
function stepLag(t: BossBarTrack, target: number, tick: number, shakeOn: boolean): void {
  if (!shakeOn) {
    t.lag = target;
    t.draining = false;
    return;
  }
  if (target >= t.lag) {
    t.lag = target;
    t.draining = false;
    return;
  }
  if (!t.draining) {
    t.drainStart = t.lag;
    t.drainStartTick = tick;
    t.draining = true;
  }
  const p = Math.min(1, (tick - t.drainStartTick) / DRAIN_TICKS);
  t.lag = t.drainStart + (target - t.drainStart) * p;
  if (p >= 1) {
    t.lag = target;
    t.draining = false;
  }
}

/** The up-to-three bars to show right now: newest three, in spawn order (oldest at the top). */
export function visibleBossBars(tracks: readonly BossBarTrack[], tick: number): BossBarTrack[] {
  return tracks
    .filter((t) => t.deadTick < 0 || tick - t.deadTick < FADE_OUT_TICKS)
    .sort((a, b) => a.enemyId - b.enemyId)
    .slice(-MAX_BARS);
}

export interface BossBarFrame {
  enemyId: number;
  kind: EnemyKind;
  name: string;
  gimmick: string | null;
  alpha: number;
  flash: boolean;
  showNew: boolean;
  hpRatio: number;
  lagRatio: number;
  shieldSegments: number;
  shieldFilled: number;
  shieldRatio: number;
}

/** The per-frame visual state of one bar, so the smoke harness can assert fills and motion. */
export function bossBarFrame(track: BossBarTrack, tick: number, shakeOn: boolean): BossBarFrame {
  const age = tick - track.bornTick;
  const alpha =
    track.deadTick >= 0
      ? Math.max(0, 1 - (tick - track.deadTick) / FADE_OUT_TICKS)
      : Math.min(1, age / FADE_IN_TICKS);
  const flash = shakeOn && track.isNew && track.deadTick < 0 && age < FLASH_TICKS;
  const showNew = track.isNew && track.deadTick < 0 && age < NEW_TAG_TICKS;
  return {
    enemyId: track.enemyId,
    kind: track.kind,
    name: track.name,
    gimmick: track.gimmick,
    alpha,
    flash,
    showNew,
    hpRatio: track.maxHp > 0 ? clamp01(track.hp / track.maxHp) : 0,
    lagRatio: clamp01(track.lag),
    shieldSegments: track.shieldSegments,
    shieldFilled: track.shieldFilled,
    shieldRatio: track.shieldRatio,
  };
}

// ---------------------------------------------------------------------------------------------
// View

const NAME_STYLE = {
  fontFamily: FONT,
  fontSize: FONT_SIZE.small,
  fontWeight: 'bold' as const,
  fill: PAL.highlight,
  letterSpacing: 1,
};

const TAG_STYLE = {
  fontFamily: FONT,
  fontSize: FONT_SIZE.small,
  fontWeight: 'bold' as const,
  fill: NEW_TAG_COLOR,
};

const SUBTITLE_STYLE = {
  fontFamily: FONT,
  fontSize: FONT_SIZE.small,
  fill: GIMMICK_COLOR,
};

export class BossBarView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly tracks: BossBarTrack[] = [];
  private readonly seen = new Set<EnemyKind>();
  private readonly onPersist: (seen: EnemyKind[]) => void;

  private readonly nameShadows: Text[] = [];
  private readonly nameTexts: Text[] = [];
  private readonly tagTexts: Text[] = [];
  private readonly subtitleTexts: Text[] = [];

  constructor(onPersist: (seen: EnemyKind[]) => void) {
    this.onPersist = onPersist;
    this.root.addChild(this.g);
    for (let i = 0; i < MAX_BARS; i++) {
      const shadow = new Text({ text: '', style: { ...NAME_STYLE, fill: PAL.dark } });
      shadow.anchor.set(0, 0);
      const name = new Text({ text: '', style: NAME_STYLE });
      name.anchor.set(0, 0);
      const tag = new Text({ text: '', style: TAG_STYLE });
      tag.anchor.set(0, 0);
      const subtitle = new Text({ text: '', style: SUBTITLE_STYLE });
      subtitle.anchor.set(1, 0);
      this.nameShadows.push(shadow);
      this.nameTexts.push(name);
      this.tagTexts.push(tag);
      this.subtitleTexts.push(subtitle);
      this.root.addChild(shadow, name, tag, subtitle);
    }
  }

  /** Seed the seen set from the profile once, at boot. */
  syncSeen(seen: readonly EnemyKind[]): void {
    this.seen.clear();
    for (const k of seen) this.seen.add(k);
  }

  draw(state: RunState, layout: Layout, shakeOn: boolean): void {
    const newlySeen = advanceBossBars(this.tracks, state.enemies, state.tick, this.seen, shakeOn);
    if (newlySeen.length > 0) this.onPersist([...this.seen]);

    const g = this.g;
    g.clear();

    const bars = visibleBossBars(this.tracks, state.tick);
    if (bars.length === 0) {
      for (let i = 0; i < MAX_BARS; i++) {
        this.nameTexts[i].text = '';
        this.nameShadows[i].text = '';
        this.tagTexts[i].text = '';
        this.subtitleTexts[i].text = '';
      }
      return;
    }

    const panel = bossPanelRect(layout, bars.length);
    const rowsFit = Math.max(1, Math.floor((panel.h - PANEL_PAD * 2 + ROW_GAP) / (ROW_H + ROW_GAP)));
    this.drawPanel(g, panel);

    for (let i = 0; i < MAX_BARS; i++) {
      const track = bars[i];
      const name = this.nameTexts[i];
      const shadow = this.nameShadows[i];
      const tag = this.tagTexts[i];
      const subtitle = this.subtitleTexts[i];
      if (!track || i >= rowsFit) {
        name.text = '';
        shadow.text = '';
        tag.text = '';
        subtitle.text = '';
        continue;
      }
      const r = bossRowRect(panel, i);
      const frame = bossBarFrame(track, state.tick, shakeOn);
      if (frame.alpha <= 0) {
        name.text = '';
        shadow.text = '';
        tag.text = '';
        subtitle.text = '';
        continue;
      }
      this.drawBar(g, r, r.w, frame);
      shadow.text = frame.name;
      shadow.position.set(r.x + 1, r.nameY + 1);
      name.text = frame.name;
      name.position.set(r.x, r.nameY);
      shadow.alpha = frame.alpha;
      name.alpha = frame.alpha;
      if (frame.showNew) {
        tag.text = 'NEW';
        tag.position.set(r.x + Math.ceil(name.width) + 6, r.nameY);
        tag.alpha = frame.alpha;
      } else {
        tag.text = '';
      }
      subtitle.text = frame.showNew && frame.gimmick !== null ? frame.gimmick : '';
      subtitle.position.set(r.x + r.w, r.nameY);
      subtitle.alpha = frame.alpha;
    }
  }

  /** The panel: a raised face border around a sunken dark well, like the rest of the chrome. */
  private drawPanel(g: Graphics, p: { x: number; y: number; w: number; h: number }): void {
    g.rect(p.x, p.y, p.w, p.h).fill({ color: PANEL_FACE });
    g.rect(p.x, p.y, p.w, 1).fill({ color: PAL.highlight });
    g.rect(p.x, p.y, 1, p.h).fill({ color: PAL.highlight });
    g.rect(p.x, p.y + p.h - 1, p.w, 1).fill({ color: PAL.dark });
    g.rect(p.x + p.w - 1, p.y, 1, p.h).fill({ color: PAL.dark });
    const well = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 4 };
    g.rect(well.x, well.y, well.w, well.h).fill({ color: PANEL_WELL });
    g.rect(well.x, well.y, well.w, 1).fill({ color: PAL.shadow });
    g.rect(well.x, well.y, 1, well.h).fill({ color: PAL.shadow });
  }

  private drawBar(g: Graphics, r: BossBarRect, width: number, f: BossBarFrame): void {
    const a = f.alpha;
    const innerW = width - 2;

    // The frame flashes once on a type's first appearance.
    if (f.flash) {
      g.rect(r.x - 2, r.y - 2, width + 4, r.h + 4).stroke({ width: 1, color: PAL.highlight, alpha: a });
    }

    // Shield bar (above the health bar).
    if (f.shieldSegments > 0) {
      bevel1(g, r.x, r.shieldY, width, SHIELD_H, a);
      if (f.shieldSegments === 1) {
        const fillW = barFillPx(innerW, f.shieldRatio);
        if (fillW > 0) g.rect(r.x + 1, r.shieldY + 1, fillW, SHIELD_H - 2).fill({ color: SHIELD_BAR, alpha: a });
      } else {
        const gap = 2;
        const segW = Math.floor((innerW - gap * (f.shieldSegments - 1)) / f.shieldSegments);
        for (let i = 0; i < f.shieldSegments; i++) {
          const sx = r.x + 1 + i * (segW + gap);
          if (i < f.shieldFilled) {
            g.rect(sx, r.shieldY + 1, segW, SHIELD_H - 2).fill({ color: SHIELD_BAR, alpha: a });
          } else {
            g.rect(sx, r.shieldY + 1, segW, SHIELD_H - 2).stroke({ width: 1, color: SHIELD_DIM, alpha: a * 0.7 });
          }
        }
      }
    }

    // Health bar: near-black track, deep red fill, pale damage-lag segment ahead of it.
    bevel1(g, r.x, r.healthY, width, HEALTH_H, a);
    const fillW = barFillPx(innerW, f.hpRatio);
    const lagW = barFillPx(innerW, f.lagRatio);
    if (fillW > 0) g.rect(r.x + 1, r.healthY + 1, fillW, HEALTH_H - 2).fill({ color: HEALTH_FILL, alpha: a });
    if (lagW > fillW) {
      g.rect(r.x + 1 + fillW, r.healthY + 1, lagW - fillW, HEALTH_H - 2).fill({ color: HEALTH_LAG, alpha: a });
    }
  }
}

/** A 1 px raised bevel: light top/left, dark bottom/right, matching the runtime chrome. */
function bevel1(g: Graphics, x: number, y: number, w: number, h: number, alpha: number): void {
  hline(g, x, x + w, y + 0.5, PAL.highlight, alpha);
  vline(g, x + 0.5, y, y + h, PAL.highlight, alpha);
  hline(g, x, x + w, y + h - 0.5, PAL.dark, alpha);
  vline(g, x + w - 0.5, y, y + h, PAL.dark, alpha);
}

function hline(g: Graphics, x0: number, x1: number, y: number, color: number, alpha: number): void {
  g.moveTo(x0, y).lineTo(x1, y).stroke({ width: 1, color, alpha });
}

function vline(g: Graphics, x: number, y0: number, y1: number, color: number, alpha: number): void {
  g.moveTo(x, y0).lineTo(x, y1).stroke({ width: 1, color, alpha });
}
