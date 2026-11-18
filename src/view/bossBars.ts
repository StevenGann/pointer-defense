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

const BAR_MAX_W = 320;
const BAR_H_MARGIN = 48; // total horizontal clearance: width <= boardW - 48, so it never touches an edge
const NAME_ROW_H = 16; // 13 px name text plus room for its 1 px shadow
const SHIELD_H = 6;
const HEALTH_H = 10;
const GAP = 2;
const TOP_MARGIN = 6; // just under the field's top edge
const STACK_GAP = 6;
const MAX_BARS = 3;
const SLOT_H = NAME_ROW_H + GAP + SHIELD_H + GAP + HEALTH_H;

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

/** The one-line gimmick subtitle for a type's first appearance, or null for the marker boss. */
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

/** The bar width: never wider than 320 and never within 24 px of a board edge. */
export function bossBarWidth(boardW: number): number {
  return Math.max(1, Math.min(BAR_MAX_W, boardW - BAR_H_MARGIN));
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

/** The bounding rect for the `index`-th stacked bar, centred over the board field. */
export function bossBarRect(l: Layout, index: number): BossBarRect {
  const w = bossBarWidth(l.boardW);
  const x = Math.round(l.board.x + l.boardW / 2 - w / 2);
  const y = l.board.y + TOP_MARGIN + index * (SLOT_H + STACK_GAP);
  return {
    x,
    y,
    w,
    h: SLOT_H,
    nameY: y,
    shieldY: y + NAME_ROW_H + GAP,
    healthY: y + NAME_ROW_H + GAP + SHIELD_H + GAP,
  };
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
  fontSize: FONT_SIZE.body,
  fontWeight: 'bold' as const,
  fill: PAL.highlight,
  letterSpacing: 2,
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
  fill: PAL.text,
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
      shadow.anchor.set(0.5, 0);
      const name = new Text({ text: '', style: NAME_STYLE });
      name.anchor.set(0.5, 0);
      const tag = new Text({ text: '', style: TAG_STYLE });
      tag.anchor.set(0, 0);
      const subtitle = new Text({ text: '', style: SUBTITLE_STYLE });
      subtitle.anchor.set(0.5, 0);
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
    const width = bossBarWidth(layout.boardW);

    for (let i = 0; i < MAX_BARS; i++) {
      const track = bars[i];
      const name = this.nameTexts[i];
      const shadow = this.nameShadows[i];
      const tag = this.tagTexts[i];
      const subtitle = this.subtitleTexts[i];
      if (!track) {
        name.text = '';
        shadow.text = '';
        tag.text = '';
        subtitle.text = '';
        continue;
      }
      const r = bossBarRect(layout, i);
      const frame = bossBarFrame(track, state.tick, shakeOn);
      if (frame.alpha <= 0) {
        name.text = '';
        shadow.text = '';
        tag.text = '';
        subtitle.text = '';
        continue;
      }
      this.drawBar(g, r, width, frame);
      const cx = r.x + width / 2;
      shadow.text = frame.name;
      shadow.position.set(cx + 1, r.nameY + 1);
      name.text = frame.name;
      name.position.set(cx, r.nameY);
      if (frame.showNew) {
        tag.text = 'NEW';
        tag.position.set(cx + Math.ceil(name.width / 2) + 6, r.nameY + 2);
      } else {
        tag.text = '';
      }
      subtitle.text = frame.showNew && frame.gimmick !== null ? frame.gimmick : '';
      subtitle.position.set(cx, r.healthY + HEALTH_H + 2);
    }
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
