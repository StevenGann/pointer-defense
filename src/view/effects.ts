import { Container, Graphics } from 'pixi.js';
import { PAL, worldToPixel, type Layout } from './chrome.ts';
import { ENEMY_STATS, type EnemyKind } from '../core/enemies.ts';
import type { Tower } from '../core/towers.ts';
import type { RunState } from '../core/state.ts';
import { drawEnemyShape, ENEMY_COLOR, TOWER_COLOR } from './board.ts';

/**
 * Short-lived combat effects, timed in fixed ticks (docs/design.md §13.4): a muzzle flash (4
 * ticks), a tracer (6), a hit flash (3) and a death collapse (8). No easing — each effect fades
 * linearly over its lifetime. The sim pushes events; this view holds the resulting sprites.
 */

const MUZZLE_TICKS = 4;
const TRACER_TICKS = 6;
const HIT_TICKS = 3;
const DEATH_TICKS = 8;

interface Muzzle {
  x: number;
  y: number;
  color: number;
  born: number;
}

interface Tracer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  born: number;
}

interface Hit {
  x: number;
  y: number;
  born: number;
}

interface Death {
  kind: EnemyKind;
  x: number;
  y: number;
  heading: number;
  born: number;
}

export class EffectsView {
  readonly root = new Container();
  private readonly g = new Graphics();

  private muzzles: Muzzle[] = [];
  private tracers: Tracer[] = [];
  private hits: Hit[] = [];
  private deaths: Death[] = [];

  constructor() {
    this.root.addChild(this.g);
  }

  addShot(tower: Tower | undefined, x: number, y: number): void {
    const color = tower ? TOWER_COLOR[tower.kind] : PAL.text;
    const ox = tower ? tower.col + 0.5 : x;
    const oy = tower ? tower.row + 0.5 : y;
    this.muzzles.push({ x: ox, y: oy, color, born: 0 });
    this.tracers.push({ x0: ox, y0: oy, x1: x, y1: y, color, born: 0 });
  }

  addHitFlash(x: number, y: number): void {
    this.hits.push({ x, y, born: 0 });
  }

  addDeath(kind: EnemyKind, x: number, y: number, heading: number): void {
    this.deaths.push({ kind, x, y, heading, born: 0 });
  }

  /** Stamp `born` with the current sim tick for every effect queued since the last draw. */
  draw(state: RunState, layout: Layout): void {
    const now = state.tick;
    for (const m of this.muzzles) if (m.born === 0) m.born = now;
    for (const t of this.tracers) if (t.born === 0) t.born = now;
    for (const h of this.hits) if (h.born === 0) h.born = now;
    for (const d of this.deaths) if (d.born === 0) d.born = now;

    this.muzzles = this.muzzles.filter((m) => now - m.born < MUZZLE_TICKS);
    this.tracers = this.tracers.filter((t) => now - t.born < TRACER_TICKS);
    this.hits = this.hits.filter((h) => now - h.born < HIT_TICKS);
    this.deaths = this.deaths.filter((d) => now - d.born < DEATH_TICKS);

    const g = this.g;
    g.clear();
    const cell = layout.board.cell;

    for (const t of this.tracers) {
      const age = now - t.born;
      const a = 1 - age / TRACER_TICKS;
      const p0 = worldToPixel(layout, t.x0, t.y0);
      const p1 = worldToPixel(layout, t.x1, t.y1);
      g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 2, color: t.color, alpha: a });
    }

    for (const m of this.muzzles) {
      const age = now - m.born;
      const a = 1 - age / MUZZLE_TICKS;
      const p = worldToPixel(layout, m.x, m.y);
      g.circle(p.x, p.y, cell * 0.18).fill({ color: m.color, alpha: a });
      g.circle(p.x, p.y, cell * 0.08).fill({ color: PAL.highlight, alpha: a });
    }

    for (const h of this.hits) {
      const age = now - h.born;
      const a = 1 - age / HIT_TICKS;
      const p = worldToPixel(layout, h.x, h.y);
      g.circle(p.x, p.y, cell * 0.14).stroke({ width: 1, color: PAL.highlight, alpha: a });
    }

    for (const d of this.deaths) {
      const age = now - d.born;
      const t = age / DEATH_TICKS;
      const scale = 1 - t;
      const p = worldToPixel(layout, d.x, d.y);
      drawEnemyShape(
        g,
        d.kind,
        p.x,
        p.y,
        cell * ENEMY_STATS[d.kind].radius * scale,
        ENEMY_COLOR[d.kind],
        d.heading,
        1 - t,
      );
    }
  }
}
