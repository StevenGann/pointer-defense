import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { canAfford } from '../core/economy.ts';
import { formatNumber } from '../core/format.ts';
import { nextStageCost, pointerInfo } from '../core/pointer.ts';
import { STARTING_INTEGRITY, type RunState } from '../core/state.ts';
import { TOWER_KINDS, TOWER_STATS, type TowerKind } from '../core/towers.ts';
import { WAVE_COUNT } from '../core/waves.ts';

/**
 * The HUD: status-bar text (hint / wave / salvage), the integrity readout, the pointer stage and
 * upgrade button, the three tower buy buttons, the Start Wave button, and the end-of-run modal.
 */

export type HudAction = 'gun' | 'cannon' | 'taser' | 'pointer' | 'wave';

interface HudLayout {
  toolbar: Rect;
  integrity: Rect;
  pointerPanel: Rect;
  pointerUpgrade: Rect;
  towers: ReadonlyArray<{ kind: TowerKind; rect: Rect }>;
  wave: Rect;
}

function computeHud(l: Layout): HudLayout {
  const margin = l.board.x - l.clientInner.x;
  const w = Math.max(60, Math.min(120, margin - 16));
  const x = l.clientInner.x + Math.floor((margin - w) / 2);
  const y = l.clientInner.y + 8;
  const toolbar: Rect = { x, y, w, h: l.clientInner.h - 16 };

  let cy = y;
  const integrity: Rect = { x, y: cy, w, h: 22 };
  cy += 22 + 6;
  const pointerPanel: Rect = { x, y: cy, w, h: 44 };
  const pointerUpgrade: Rect = { x: x + 4, y: cy + 22, w: w - 8, h: 18 };
  cy += 44 + 8;
  const towers = TOWER_KINDS.map((kind) => {
    const rect: Rect = { x, y: cy, w, h: 26 };
    cy += 26 + 4;
    return { kind, rect };
  });
  cy += 4;
  const wave: Rect = { x, y: cy, w, h: 28 };

  return { toolbar, integrity, pointerPanel, pointerUpgrade, towers, wave };
}

export function hudButtonAt(l: Layout, s: RunState, px: number, py: number): HudAction | null {
  const h = computeHud(l);
  const cost = nextStageCost(s.pointer);
  if (cost !== null && canAfford(s.economy, cost) && pointInRect(h.pointerUpgrade, px, py)) return 'pointer';
  for (const t of h.towers) {
    if (canAfford(s.economy, TOWER_STATS[t.kind].cost) && pointInRect(t.rect, px, py)) return t.kind;
  }
  if (s.phase === 'build' && pointInRect(h.wave, px, py)) return 'wave';
  return null;
}

function modalRect(l: Layout): Rect {
  const w = 300;
  const h = 132;
  return {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
}

function restartRect(m: Rect): Rect {
  const w = 96;
  const h = 24;
  return { x: m.x + Math.floor((m.w - w) / 2), y: m.y + m.h - h - 10, w, h };
}

export function modalRestartAt(l: Layout, s: RunState, px: number, py: number): boolean {
  if (s.phase !== 'halted' && s.phase !== 'victory') return false;
  return pointInRect(restartRect(modalRect(l)), px, py);
}

function hintFor(s: RunState): string {
  if (s.selected) return `Click a tile to place ${TOWER_STATS[s.selected].name} — right-click to cancel`;
  switch (s.phase) {
    case 'build':
      return 'Place towers, then start the wave';
    case 'wave':
      return 'Click enemies to shoot — hold for the reticle';
    case 'halted':
      return 'The lane broke. Click Restart to try again';
    case 'victory':
      return 'All waves cleared!';
  }
}

function makeText(text: string, bold = false): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: 11, fill: PAL.text, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class HudView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly modalG = new Graphics();

  private readonly statusHint = makeText('');
  private readonly statusWave = makeText('');
  private readonly statusSalvage = makeText('');
  private readonly integrity = makeText('');
  private readonly pointerLabel = makeText('');
  private readonly pointerButton = makeText('');
  private readonly towerButtons: Text[];
  private readonly waveButton = makeText('', true);
  private readonly modalTitle = makeText('', true);
  private readonly modalMessage = makeText('');
  private readonly modalRestart = makeText('Restart');

  constructor() {
    this.towerButtons = TOWER_KINDS.map(() => makeText(''));
    this.root.addChild(this.g);
    for (const t of [
      this.statusHint,
      this.statusWave,
      this.statusSalvage,
      this.integrity,
      this.pointerLabel,
      this.pointerButton,
      ...this.towerButtons,
      this.waveButton,
    ]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    this.root.addChild(this.modalG);
    for (const t of [this.modalTitle, this.modalMessage, this.modalRestart]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    this.modalTitle.style.fill = PAL.titleInverse;
    this.modalRestart.anchor.set(0.5, 0.5);
  }

  draw(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    g.clear();

    // Status bar text.
    const sp = l.statusPanes;
    this.statusHint.text = hintFor(s);
    this.statusHint.position.set(sp.left.x + 4, sp.left.y + Math.floor(sp.left.h / 2));
    this.statusWave.text = `Wave ${s.phase === 'build' ? s.wave + 1 : s.wave} / ${WAVE_COUNT}`;
    this.statusWave.position.set(sp.middle.x + 4, sp.middle.y + Math.floor(sp.middle.h / 2));
    this.statusSalvage.text = `$${formatNumber(s.economy.salvage)}`;
    this.statusSalvage.position.set(sp.right.x + 4, sp.right.y + Math.floor(sp.right.h / 2));

    // Toolbar.
    const h = computeHud(l);

    bevel(g, h.integrity, false, PAL.face);
    this.integrity.text = `Integrity: ${s.integrity}/${STARTING_INTEGRITY}`;
    this.integrity.position.set(h.integrity.x + 6, h.integrity.y + Math.floor(h.integrity.h / 2));

    bevel(g, h.pointerPanel, true, PAL.face);
    this.pointerLabel.text = `Pointer: ${pointerInfo(s.pointer).name}`;
    this.pointerLabel.position.set(h.pointerPanel.x + 6, h.pointerPanel.y + 11);

    const cost = nextStageCost(s.pointer);
    const pointerEnabled = cost !== null && canAfford(s.economy, cost);
    this.pointerButton.text = cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`;
    drawButton(g, h.pointerUpgrade, pointerEnabled, hoverHud === 'pointer');
    this.pointerButton.style.fill = pointerEnabled ? PAL.text : PAL.shadow;
    this.pointerButton.position.set(
      h.pointerUpgrade.x + 6,
      h.pointerUpgrade.y + Math.floor(h.pointerUpgrade.h / 2),
    );

    for (let i = 0; i < h.towers.length; i++) {
      const { kind, rect } = h.towers[i];
      const enabled = canAfford(s.economy, TOWER_STATS[kind].cost);
      const armed = s.selected === kind;
      drawButton(g, rect, enabled, hoverHud === kind, armed);
      const t = this.towerButtons[i];
      t.text = `${TOWER_STATS[kind].name}  $${formatNumber(TOWER_STATS[kind].cost)}`;
      t.style.fill = enabled ? (armed ? PAL.title : PAL.text) : PAL.shadow;
      t.position.set(rect.x + 6, rect.y + Math.floor(rect.h / 2));
    }

    if (s.phase === 'build') {
      drawButton(g, h.wave, true, hoverHud === 'wave');
      this.waveButton.text = `Start Wave ${s.wave + 1}`;
      this.waveButton.style.fill = PAL.text;
      this.waveButton.position.set(h.wave.x + 6, h.wave.y + Math.floor(h.wave.h / 2));
    } else {
      this.waveButton.text = '';
    }

    // End-of-run modal.
    this.modalG.clear();
    if (s.phase === 'halted' || s.phase === 'victory') {
      this.drawModal(s, l);
    } else {
      this.modalTitle.text = '';
      this.modalMessage.text = '';
      this.modalRestart.text = '';
    }
  }

  private drawModal(s: RunState, l: Layout): void {
    const g = this.modalG;
    const m = modalRect(l);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });

    bevel(g, m, true, PAL.face);
    g.rect(m.x + 2, m.y + 2, m.w - 4, 18).fill(PAL.title);
    this.modalTitle.text = s.phase === 'victory' ? 'Victory' : 'Game Over';
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 9);

    this.modalMessage.text =
      s.phase === 'victory' ? 'You cleared all ten waves.' : `The lane broke at wave ${s.wave}.`;
    this.modalMessage.position.set(m.x + 12, m.y + 2 + 18 + 16);

    const r = restartRect(m);
    bevel(g, r, true, PAL.face);
    this.modalRestart.text = 'Restart';
    this.modalRestart.position.set(r.x + r.w / 2, r.y + r.h / 2);
  }
}

function drawButton(g: Graphics, r: Rect, enabled: boolean, hovered: boolean, pressed = false): void {
  if (enabled) {
    bevel(g, r, !pressed, PAL.face);
  } else {
    g.rect(r.x, r.y, r.w, r.h).fill(PAL.face);
    g.rect(r.x, r.y, r.w, r.h).stroke({ width: 1, color: PAL.shadow });
  }
  if (hovered && enabled) {
    g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4).stroke({ width: 1, color: PAL.dark });
  }
}
