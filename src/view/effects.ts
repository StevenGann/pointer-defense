import { Container, Graphics, Sprite } from 'pixi.js';
import { PAL, worldToPixel, type Layout } from './chrome.ts';
import { ENEMY_STATS, isBossVariant, type EnemyKind } from '../core/enemies.ts';
import type { Branch, Tower, TowerKind } from '../core/towers.ts';
import type { RunState } from '../core/state.ts';
import { ENEMY_COLOR, SHIELD_COLOR, TOWER_COLOR, TRACER_COLOR } from './board.ts';
import { animationOf, artNameForBranch, effectFrameTexture, getArtFrames } from './art.ts';
import { secondsToWholeTicks } from './anim.ts';

/**
 * Short-lived combat effects, timed in fixed ticks so a 30 fps and a 60 fps frame show the same
 * effect for the same simulation ticks. Every pool is capped, and effects are removed in place (no
 * unbounded allocation), so a wave of forty enemies at x3 speed cannot balloon the draw. The sim
 * pushes events; this view holds the resulting sprites and never touches the simulation.
 */

const MUZZLE_TICKS = 2;
const TRACER_TICKS = 6;
const HIT_TICKS = 4;
const SHIELD_ARC_TICKS = 8;
const DEATH_TICKS = 6;
const KNOCKBACK_TICKS = 3;

const CAP_MUZZLE = 96;
const CAP_TRACER = 256;
const CAP_SPARK = 96;
const CAP_SHIELD = 96;
const CAP_DEATH = 96;

/**
 * The fire-effect asset for a tower. A branched tower resolves its own file first
 * (`muzzle-gun-marksman`), then the kind's (`muzzle-gun`); a kind with no file at all — the Beacon,
 * the Repair tower, the Wall — falls back to the procedural flash. Files may ship numbered frames
 * (`muzzle-gun.1.svg`, ...) with an optional `.json` animation, in which case the effect plays the
 * animation for its duration instead of the two-tick flash.
 */
/**
 * Branches whose fire effect exists even though the tower draws its branch on the base art rather
 * than a separate branch mark. The AA is the case today: Flak and Missile change the turret, so
 * `artNameForBranch` has no answer for it, but each still gets its own muzzle.
 */
const EXTRA_FIRE_MARKS: Readonly<Partial<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>>> = {
  aa: { A: 'aa-flak', B: 'aa-missile' },
};

export function muzzleAssetFor(kind: TowerKind, branch: Branch | null): string | null {
  if (branch !== null) {
    const extra = EXTRA_FIRE_MARKS[kind]?.[branch];
    if (extra !== undefined) return `muzzle-${extra}`;
    const mark = artNameForBranch(kind, branch);
    if (mark !== null) return `muzzle-${mark}`;
  }
  return FIRE_KINDS.has(kind) ? `muzzle-${kind}` : null;
}

/** Towers that fire something. The Beacon buffs, the Repair tower heals, walls do neither. */
export const FIRE_KINDS: ReadonlySet<TowerKind> = new Set<TowerKind>(['gun', 'cannon', 'laser', 'taser', 'frost', 'aa', 'cursor']);

/** The death-ring ring radius in viewBox units; the sprite is scaled so this maps to the live radius. */
const DEATH_RING_SVG_RADIUS = 12;

interface Muzzle {
  x: number;
  y: number;
  angle: number;
  kind: TowerKind;
  /** Resolved asset name, or null when the kind has no file (then the procedural flash draws). */
  asset: string | null;
  /** Lifetime in ticks: two for a still, the animation's duration when the file has frames. */
  life: number;
  color: number;
  born: number;
}

/** How long a fire effect lives. A framed file plays its whole animation; a still flashes briefly. */
export function muzzleLife(asset: string | null, px: number): number {
  if (asset === null) return MUZZLE_TICKS;
  const frames = getArtFrames(asset, px).length;
  if (frames <= 1) return MUZZLE_TICKS;
  const fps = animationOf(asset)?.fps ?? 30;
  return Math.max(MUZZLE_TICKS, secondsToWholeTicks(frames / fps));
}

interface Tracer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  born: number;
}

interface Spark {
  x: number;
  y: number;
  born: number;
}

interface ShieldArc {
  x: number;
  y: number;
  born: number;
}

interface Death {
  kind: EnemyKind;
  x: number;
  y: number;
  born: number;
}

interface Knockback {
  dx: number;
  dy: number;
  born: number;
}

function pushCap<T>(arr: T[], cap: number, item: T): void {
  if (arr.length >= cap) arr.shift();
  arr.push(item);
}

/** Remove expired effects in place, keeping the array length within the cap without reallocating. */
function compact(arr: { born: number }[], now: number, life: number): void {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    if (now - arr[i].born < life) arr[w++] = arr[i];
  }
  arr.length = w;
}

/** The same compaction for a pool whose entries carry their own lifetime (fire effects do). */
function compactByLife<T extends { born: number; life: number }>(arr: T[], now: number): void {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    if (now - arr[i].born < arr[i].life) arr[w++] = arr[i];
  }
  arr.length = w;
}

export class EffectsView {
  readonly root = new Container();
  readonly tracerRoot = new Container();
  private readonly tracerG = new Graphics();
  private readonly g = new Graphics();
  private readonly muzzleLayer = new Container();
  private readonly sparkLayer = new Container();
  private readonly shieldLayer = new Container();
  private readonly deathLayer = new Container();

  private muzzles: Muzzle[] = [];
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private shieldArcs: ShieldArc[] = [];
  private deaths: Death[] = [];
  private readonly knockbacks = new Map<number, Knockback>();

  readonly muzzleSprites: Sprite[] = [];
  readonly sparkSprites: Sprite[] = [];
  readonly shieldSprites: Sprite[] = [];
  readonly deathSprites: Sprite[] = [];

  constructor() {
    // Tracers draw into their own Graphics so main.ts can parent tracerRoot under the board's shots
    // layer (docs/TRACER-LAYER.md). The procedural fallback Graphics and the sprite layers stay in
    // effects.root: muzzles, sparks, shield arcs, deaths.
    this.tracerRoot.addChild(this.tracerG);
    this.root.addChild(this.g, this.muzzleLayer, this.sparkLayer, this.shieldLayer, this.deathLayer);
  }

  /** The pooled sprite for `pool[index]`, created on demand and reused forever (no per-frame alloc). */
  private pooledSprite(pool: Sprite[], layer: Container, index: number): Sprite {
    let s = pool[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      pool[index] = s;
      layer.addChild(s);
    }
    s.visible = true;
    return s;
  }

  addShot(tower: Tower | undefined, x: number, y: number): void {
    if (!tower || tower.kind === 'beacon') return;
    const ox = tower.col + 0.5;
    const oy = tower.row + 0.5;
    const asset = muzzleAssetFor(tower.kind, tower.branch);
    pushCap(this.muzzles, CAP_MUZZLE, {
      x: ox,
      y: oy,
      angle: Math.atan2(y - oy, x - ox),
      kind: tower.kind,
      asset,
      life: muzzleLife(asset, 32),
      color: TOWER_COLOR[tower.kind],
      born: 0,
    });
    // A tracer is the shot only for a line tower (docs/LINE-TRACERS.md): the Gun's yellow line and
    // the Laser's red beam. Towers that launch a projectile — Cannon, Flak, Missile — or carry their
    // own effect — the Taser's arc, the Frost's pulse — keep the muzzle flash and sound but draw no
    // line.
    const tracerColor = TRACER_COLOR[tower.kind];
    if (tracerColor !== undefined) {
      pushCap(this.tracers, CAP_TRACER, {
        x0: ox,
        y0: oy,
        x1: x,
        y1: y,
        color: tracerColor,
        born: 0,
      });
    }
  }

  addHitSpark(x: number, y: number): void {
    pushCap(this.sparks, CAP_SPARK, { x, y, born: 0 });
  }

  /** A breacher turret shot: a muzzle flash at the nose and a tracer to the tower it hit. */
  addBreacherShot(x: number, y: number, tx: number, ty: number): void {
    pushCap(this.muzzles, CAP_MUZZLE, {
      x,
      y,
      angle: Math.atan2(ty - y, tx - x),
      kind: 'gun',
      asset: 'muzzle-gun',
      life: muzzleLife('muzzle-gun', 32),
      color: ENEMY_COLOR.breacher,
      born: 0,
    });
    pushCap(this.tracers, CAP_TRACER, {
      x0: x,
      y0: y,
      x1: tx,
      y1: ty,
      color: ENEMY_COLOR.breacher,
      born: 0,
    });
  }

  addShieldHit(x: number, y: number): void {
    pushCap(this.shieldArcs, CAP_SHIELD, { x, y, born: 0 });
  }

  addDeath(kind: EnemyKind, x: number, y: number): void {
    pushCap(this.deaths, CAP_DEATH, { kind, x, y, born: 0 });
  }

  /** A cosmetic 1 px nudge along the shot direction; stored by enemy id for the board draw. */
  addKnockback(id: number, dx: number, dy: number, tick: number): void {
    this.knockbacks.set(id, { dx, dy, born: tick });
  }

  /** The pixel offset for an enemy this tick, or null once the nudge has decayed. */
  knockbackOffset(id: number, tick: number): { dx: number; dy: number } | null {
    const k = this.knockbacks.get(id);
    if (!k) return null;
    const age = tick - k.born;
    if (age < 0 || age >= KNOCKBACK_TICKS) {
      this.knockbacks.delete(id);
      return null;
    }
    const m = 1 - age / KNOCKBACK_TICKS;
    return { dx: k.dx * m, dy: k.dy * m };
  }

  /** Stamp `born` with the current sim tick for every effect queued since the last draw. */
  draw(state: RunState, layout: Layout): void {
    const now = state.tick;
    for (const m of this.muzzles) if (m.born === 0) m.born = now;
    for (const t of this.tracers) if (t.born === 0) t.born = now;
    for (const s of this.sparks) if (s.born === 0) s.born = now;
    for (const s of this.shieldArcs) if (s.born === 0) s.born = now;
    for (const d of this.deaths) if (d.born === 0) d.born = now;

    compactByLife(this.muzzles, now);
    compact(this.tracers, now, TRACER_TICKS);
    compact(this.sparks, now, HIT_TICKS);
    compact(this.shieldArcs, now, SHIELD_ARC_TICKS);
    compact(this.deaths, now, DEATH_TICKS);
    for (const [id, k] of this.knockbacks) {
      if (now - k.born >= KNOCKBACK_TICKS) this.knockbacks.delete(id);
    }

    const g = this.g;
    g.clear();
    const tg = this.tracerG;
    tg.clear();
    const cell = layout.board.cell;

    for (const t of this.tracers) {
      const age = now - t.born;
      const a = 1 - age / TRACER_TICKS;
      const p0 = worldToPixel(layout, t.x0, t.y0);
      const p1 = worldToPixel(layout, t.x1, t.y1);
      tg.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 2, color: t.color, alpha: a });
    }

    for (let i = 0; i < this.muzzles.length; i++) {
      const m = this.muzzles[i];
      const age = now - m.born;
      const a = 1 - age / Math.max(1, m.life);
      const p = worldToPixel(layout, m.x, m.y);
      const ox = p.x + Math.cos(m.angle) * cell * 0.25;
      const oy = p.y + Math.sin(m.angle) * cell * 0.25;
      const tex = m.asset !== null ? effectFrameTexture(m.asset, cell, age, m.life) : null;
      const spr = this.pooledSprite(this.muzzleSprites, this.muzzleLayer, i);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = cell;
        spr.height = cell;
        spr.position.set(ox, oy);
        spr.rotation = m.angle;
        spr.alpha = a;
        spr.tint = 0xffffff;
      } else {
        spr.visible = false;
        drawMuzzle(g, m.kind, m.color, ox, oy, m.angle, cell, a);
      }
    }
    hideSprites(this.muzzleSprites, this.muzzles.length);

    // A hit spark: three short lines radiating from the impact point.
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i];
      const age = now - s.born;
      const a = 1 - age / HIT_TICKS;
      const p = worldToPixel(layout, s.x, s.y);
      const tex = effectFrameTexture('spark-hit', cell, age, HIT_TICKS);
      const spr = this.pooledSprite(this.sparkSprites, this.sparkLayer, i);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = cell;
        spr.height = cell;
        spr.position.set(p.x, p.y);
        spr.rotation = 0;
        spr.alpha = a;
        spr.tint = 0xffffff;
      } else {
        spr.visible = false;
        const r = cell * 0.22;
        for (let k = 0; k < 3; k++) {
          const ang = (Math.PI * 2 * k) / 3 + 0.4;
          g.moveTo(p.x + Math.cos(ang) * r * 0.4, p.y + Math.sin(ang) * r * 0.4)
            .lineTo(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r);
        }
        g.stroke({ width: 1, color: PAL.highlight, alpha: a });
      }
    }
    hideSprites(this.sparkSprites, this.sparks.length);

    // A shield hit draws a cyan arc at the impact point instead of a spark.
    for (let i = 0; i < this.shieldArcs.length; i++) {
      const s = this.shieldArcs[i];
      const age = now - s.born;
      const a = 1 - age / SHIELD_ARC_TICKS;
      const p = worldToPixel(layout, s.x, s.y);
      const tex = effectFrameTexture('shield-arc', cell, age, SHIELD_ARC_TICKS);
      const spr = this.pooledSprite(this.shieldSprites, this.shieldLayer, i);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = cell;
        spr.height = cell;
        spr.position.set(p.x, p.y);
        spr.rotation = 0;
        spr.alpha = a;
        spr.tint = 0xffffff;
      } else {
        spr.visible = false;
        const r = cell * 0.22;
        g.moveTo(p.x + r, p.y)
          .arc(p.x, p.y, r, 0, Math.PI * 1.5)
          .stroke({ width: 2, color: SHIELD_COLOR, alpha: a });
      }
    }
    hideSprites(this.shieldSprites, this.shieldArcs.length);

    // A death pop: the ring-plus-shards asset, tinted to the enemy's colour and scaled/rotated/faded
    // so the ring expands and the shards orbit exactly as the procedural version did.
    for (let i = 0; i < this.deaths.length; i++) {
      const d = this.deaths[i];
      const age = now - d.born;
      const t = age / DEATH_TICKS;
      const p = worldToPixel(layout, d.x, d.y);
      const color = ENEMY_COLOR[d.kind];
      const r0 = cell * ENEMY_STATS[d.kind].radius;
      const a = 1 - t;
      const tex = effectFrameTexture('death-ring', cell, age, DEATH_TICKS);
      const spr = this.pooledSprite(this.deathSprites, this.deathLayer, i);
      if (tex !== null) {
        spr.texture = tex;
        const size = r0 * (32 / DEATH_RING_SVG_RADIUS) * (1 + t * 1.5);
        spr.width = size;
        spr.height = size;
        spr.position.set(p.x, p.y);
        spr.rotation = t * 0.7;
        spr.alpha = a;
        spr.tint = color;
        spr.visible = true;
      } else {
        spr.visible = false;
        g.circle(p.x, p.y, r0 * (1 + t * 1.5)).stroke({ width: 2, color, alpha: a });
        for (let k = 0; k < 3; k++) {
          const ang = (Math.PI * 2 * k) / 3 + t * 0.7;
          const dist = r0 * (0.35 + t * 1.4);
          g.circle(
            p.x + Math.cos(ang) * dist,
            p.y + Math.sin(ang) * dist,
            Math.max(1, r0 * 0.16 * (1 - t)),
          ).fill({ color, alpha: a });
        }
      }
      if (isBossVariant(d.kind)) {
        // A boss-variant death pops with its crown notch, so a boss falling reads differently from
        // an ordinary death. Drawn over whichever version of the ring is in use.
        const nw = r0 * 0.32;
        g.moveTo(p.x - nw, p.y - r0 * (1 + t * 1.5))
          .lineTo(p.x, p.y - r0 * (1 + t * 1.5) - r0 * 0.18)
          .lineTo(p.x + nw, p.y - r0 * (1 + t * 1.5))
          .stroke({ width: 1, color: PAL.dark, alpha: a });
      }
    }
    hideSprites(this.deathSprites, this.deaths.length);
  }
}

/** Hide any pooled sprites past the live effect count, so leftovers from a busier frame vanish. */
function hideSprites(pool: Sprite[], count: number): void {
  for (let i = count; i < pool.length; i++) pool[i].visible = false;
}

/**
 * The weapon-specific muzzle flash: a bright wedge for the gun, a round puff for the cannon (and
 * frost), a cross-spark for the laser, and an arc flicker for the taser. The beacon has none.
 */
function drawMuzzle(
  g: Graphics,
  kind: TowerKind,
  color: number,
  x: number,
  y: number,
  angle: number,
  cell: number,
  alpha: number,
): void {
  const s = cell * 0.26;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const px = -sin;
  const py = cos;

  if (kind === 'gun') {
    const tipX = x + cos * s * 1.5;
    const tipY = y + sin * s * 1.5;
    const bx = x - cos * s * 0.5;
    const by = y - sin * s * 0.5;
    g.poly([
      tipX, tipY,
      bx + px * s * 0.55, by + py * s * 0.55,
      bx - px * s * 0.55, by - py * s * 0.55,
    ]).fill({ color: PAL.highlight, alpha });
  } else if (kind === 'cannon' || kind === 'frost') {
    g.circle(x, y, s).fill({ color: PAL.highlight, alpha });
    g.circle(x, y, s * 0.45).fill({ color, alpha });
  } else if (kind === 'laser') {
    const l = s * 1.4;
    g.moveTo(x - cos * l, y - sin * l).lineTo(x + cos * l, y + sin * l);
    g.moveTo(x - px * l, y - py * l).lineTo(x + px * l, y + py * l);
    g.stroke({ width: 2, color: PAL.highlight, alpha });
  } else {
    g.moveTo(x + Math.cos(angle - 0.8) * s, y + Math.sin(angle - 0.8) * s)
      .arc(x, y, s, angle - 0.8, angle + 0.8)
      .stroke({ width: 2, color: PAL.highlight, alpha });
  }
}
