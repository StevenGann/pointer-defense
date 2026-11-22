import { Container, Text } from 'pixi.js';
import { FONT, PAL, worldToPixel, type Layout } from './chrome.ts';
import { SHIELD_COLOR } from './board.ts';
import { t } from '../i18n/index.ts';
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

/** The loud colour crits pop in, so a lucky streak reads at a glance. */
const CRIT_COLOR = 0xff3300;

interface Float {
  x: number;
  y: number;
  amount: number;
  weak: boolean;
  crit: boolean;
  shield: boolean;
  bornTick: number;
}

function formatAmount(n: number): string {
  const rounded = Math.round(n);
  return Math.abs(n - rounded) < 1e-6 ? String(rounded) : n.toFixed(1);
}

/** Damage numbers grow with the size of the hit (log-scaled), so a 6 and a 90 read at a glance. */
function damageFontSize(amount: number, weak: boolean, crit: boolean): number {
  const base = weak || crit ? 16 : 12;
  const scale = Math.min(2.2, 0.85 + 0.4 * Math.log10(Math.max(1, amount) + 1));
  return Math.round(base * scale);
}

export class FloatingNumbersView {
  readonly root = new Container();
  private active: Float[] = [];
  private readonly texts: Text[] = [];

  addDamage(x: number, y: number, amount: number, weak: boolean, crit: boolean, tick: number): void {
    this.active.push({ x, y, amount, weak, crit, shield: false, bornTick: tick });
  }

  addShield(x: number, y: number, amount: number, tick: number): void {
    this.active.push({ x, y, amount, weak: false, crit: false, shield: true, bornTick: tick });
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
      const text = this.texts[i];
      const age = now - f.bornTick;
      const p = worldToPixel(layout, f.x, f.y);
      text.style.fill = f.shield ? SHIELD_COLOR : f.crit ? CRIT_COLOR : f.weak ? PAL.navy : PAL.text;
      text.style.fontSize = f.shield ? 12 : damageFontSize(f.amount, f.weak, f.crit);
      const amount = formatAmount(f.amount);
      text.text = f.shield ? t('screen.number.shield', { amount }) : f.crit ? t('screen.number.crit', { amount }) : amount;
      text.alpha = age >= LIFE_TICKS - FADE_TICKS ? (LIFE_TICKS - age) / FADE_TICKS : 1;
      text.position.set(p.x, p.y - (RISE_PX * age) / LIFE_TICKS);
      text.visible = true;
    }
    for (let i = this.active.length; i < this.texts.length; i++) {
      this.texts[i].visible = false;
    }
  }

  /** Drop every live float and hide every pooled text (docs/RUN-VISUAL-RESET.md). */
  reset(): void {
    this.active.length = 0;
    for (const text of this.texts) text.visible = false;
  }
}
