import { pointInRect, pixelToWorld, type Layout } from './chrome.ts';
import { computeHud, computeRightPanel, hudControlAt, type HudAction } from './hud.ts';
import { enemyAt, towerAt, type RunState } from '../core/state.ts';
import { isTowerKind, type TowerKind } from '../core/towers.ts';
import { isBossVariant, type EnemyKind } from '../core/enemies.ts';

/**
 * Context help (docs/CONTEXT-HELP.md): the `?` title-bar box that turns the pointer into a question
 * mark and opens Help at the page for the next thing clicked.
 *
 * Everything here is pure and Pixi-free so the smoke harness can assert the mode, the mapping table
 * and that a help-mode click never mutates the run state. The hit is resolved with the same helpers
 * the normal click path uses (`towerAt`, `hudControlAt`, the enemy pick), so the two cannot drift.
 */

export type ContextHelpHit =
  | { kind: 'tower'; tower: TowerKind }
  | { kind: 'enemy'; enemy: EnemyKind }
  | { kind: 'control'; control: 'pointer' | 'salvage' | 'integrity' | 'wave' | 'next-wave' | 'upgrades' | 'specs' | 'records' }
  | { kind: 'board' }
  | { kind: 'none' };

export type HelpModeAction = 'press-help' | 'click' | 'cancel';

/** The single context-help mode transition: press-help toggles, click and cancel clear it. */
export function nextHelpMode(mode: boolean, action: HelpModeAction): boolean {
  switch (action) {
    case 'press-help':
      return !mode;
    case 'click':
    case 'cancel':
      return false;
  }
}

/** The Help page id for a resolved hit, or null when nothing is written about it. */
export function contextHelpPage(hit: ContextHelpHit): string | null {
  switch (hit.kind) {
    case 'tower':
      return hit.tower === 'wall' ? 'mechanics-walls' : `tower-${hit.tower}`;
    case 'enemy':
      return isBossVariant(hit.enemy) ? `boss-${hit.enemy}` : `enemy-${hit.enemy}`;
    case 'control':
      switch (hit.control) {
        case 'pointer':
          return 'mechanics-pointer';
        case 'salvage':
          return 'mechanics-salvage';
        case 'wave':
        case 'next-wave':
          return 'mechanics-early-call';
        default:
          return null;
      }
    case 'board':
      return 'mechanics-pointer';
    case 'none':
      return null;
  }
}

/** Turn a HUD action into the context-help hit it represents (unknown controls resolve to none). */
function controlHit(action: HudAction): ContextHelpHit {
  if (isTowerKind(action)) return { kind: 'tower', tower: action };
  switch (action) {
    case 'pointer':
      return { kind: 'control', control: 'pointer' };
    case 'wave':
      return { kind: 'control', control: 'wave' };
    case 'upgrades':
      return { kind: 'control', control: 'upgrades' };
    case 'restore':
      return { kind: 'control', control: 'specs' };
    default:
      return { kind: 'none' };
  }
}

/**
 * Resolve the kind of the thing under the pointer, mirroring the normal click path's priority (HUD
 * controls, then the readouts and panels it does not cover, then a tower, then an enemy, then the
 * board itself). This only inspects the state — it never acts on it.
 */
export function contextHelpHitAt(s: RunState, l: Layout, x: number, y: number): ContextHelpHit {
  const control = hudControlAt(l, s, x, y);
  if (control) return controlHit(control.action);

  const hud = computeHud(l, s);
  if (pointInRect(hud.salvage, x, y)) return { kind: 'control', control: 'salvage' };
  if (pointInRect(hud.integrity, x, y)) return { kind: 'control', control: 'integrity' };
  const right = computeRightPanel(l, s);
  if (pointInRect(right.nextWave.rect, x, y)) return { kind: 'control', control: 'next-wave' };

  const onBoard = x >= l.board.x && x < l.board.x + l.boardW && y >= l.board.y && y < l.board.y + l.boardH;
  if (onBoard) {
    const w = pixelToWorld(l, x, y);
    const col = Math.floor(w.x);
    const row = Math.floor(w.y);
    const tower = towerAt(s, col, row);
    if (tower) return { kind: 'tower', tower: tower.kind };
    if (s.phase === 'wave') {
      const enemy = enemyAt(s, w.x, w.y);
      if (enemy) return { kind: 'enemy', enemy: enemy.kind };
    }
    return { kind: 'board' };
  }

  return { kind: 'none' };
}
