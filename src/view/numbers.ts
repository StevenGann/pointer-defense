import { Container, Text } from 'pixi.js';
import { FONT, PAL, worldToPixel, type Layout } from './chrome.ts';
import type { RunState } from '../core/state.ts';

/**
 * Floating damage numbers. Pure view: the wiring feeds it `damage` events via `addDamage` and it
 * renders short-lived labels that rise 12px over 30 ticks and fade in the last 10. Weak-point hits
 * are larger and navy; everything else is black. Capped at 40 live numbers, dropping the oldest.
 */

const LIFE_TICKS = 30;
const FADE_TICKS = 10;
const RISE_PX = 12;
const CAP = 40;

interface Float {
  x: number;
  y: number;
  amount: number;
  weak: boolean;
  bornTick: number;
}

function formatAmount(n: number): string {
  const rounded = Math.round(n);
  return Math.abs(n - rounded) < 1e-6 ? String(rounded) : n.toFixed(1);
}

export class FloatingNumbersView {
  readonly root = new Container();
  private active: Float[] = [];
  private readonly texts: Text[] = [];

  addDamage(x: number, y: number, amount: number, weak: boolean, tick: number): void {
    this.active.push({ x, y, amount, weak, bornTick: tick });
  }

  draw(state: RunState, layout: Layout): void {
    const now = state.tick;
    this.active = this.active.filter((f) => now - f.bornTick < LIFE_TICKS);
    if (this.active.length > CAP) this.active.splice(0, this.active.length - CAP);

    while (this.texts.length < this.active.length) {
      const t = new Text({ style: { fontFamily: FONT, fontWeight: 'bold' } });
      t.anchor.set(0.5, 1);
      this.root.addChild(t);
      this.texts.push(t);
    }

    for (let i = 0; i < this.active.length; i++) {
      const f = this.active[i];
      const t = this.texts[i];
      const age = now - f.bornTick;
      const p = worldToPixel(layout, f.x, f.y);
      t.style.fill = f.weak ? PAL.navy : PAL.text;
      t.style.fontSize = f.weak ? 14 : 11;
      t.text = formatAmount(f.amount);
      t.alpha = age >= LIFE_TICKS - FADE_TICKS ? (LIFE_TICKS - age) / FADE_TICKS : 1;
      t.position.set(p.x, p.y - (RISE_PX * age) / LIFE_TICKS);
      t.visible = true;
    }
    for (let i = this.active.length; i < this.texts.length; i++) {
      this.texts[i].visible = false;
    }
  }
}
