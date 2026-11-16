import type { Application } from 'pixi.js';
import { menuItemAt, pixelToWorld, pointInRect, type Layout } from '../view/chrome.ts';
import { hudButtonAt, modalRestartAt, type HudAction } from '../view/hud.ts';
import { popupCloseRect } from '../view/popup.ts';
import { dismissPopup } from '../core/popups.ts';
import { canAfford } from '../core/economy.ts';
import { tileAt } from '../core/grid.ts';
import { TOWER_KINDS, TOWER_STATS, type TowerKind } from '../core/towers.ts';
import {
  cancelSelection,
  chooseBranch,
  enemyAt,
  placeTower,
  pointerDown,
  pointerMove,
  pointerUp,
  selectedTower,
  selectPlacedTower,
  selectTower,
  sellTower,
  startWave,
  towerAt,
  upgradePointer,
  upgradeTower,
  type RunState,
} from '../core/state.ts';

/**
 * Hit testing and gestures against the run state. Tracks the hover state (which the views read)
 * and translates raw mouse events into the core reducers.
 */

export interface HoverState {
  x: number;
  y: number;
  menuItem: number;
  hud: HudAction | null;
  onBoard: boolean;
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  overRestart: boolean;
}

export interface MouseContext {
  layout: () => Layout;
  state: () => RunState;
  restart: () => void;
  notice: (message: string) => void;
}

function refusalReason(s: RunState, kind: TowerKind, col: number, row: number): string {
  if (tileAt(s.grid, col, row) !== 'buildable') return 'That tile is blocked.';
  if (towerAt(s, col, row)) return 'There is already a tower there.';
  if (!canAfford(s.economy, TOWER_STATS[kind].cost)) return 'Not enough salvage for that tower.';
  return 'That would seal the route.';
}

export class MouseController {
  readonly hover: HoverState = {
    x: 0,
    y: 0,
    menuItem: -1,
    hud: null,
    onBoard: false,
    col: -1,
    row: -1,
    worldX: 0,
    worldY: 0,
    overRestart: false,
  };

  private readonly ctx: MouseContext;
  private readonly canvas: HTMLCanvasElement;

  constructor(app: Application, ctx: MouseContext) {
    this.ctx = ctx;
    this.canvas = app.canvas;
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('contextmenu', this.onContext);
    window.addEventListener('keydown', this.onKey);
  }

  private localPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onMove = (e: PointerEvent): void => {
    const { x, y } = this.localPoint(e);
    const s = this.ctx.state();
    const l = this.ctx.layout();
    const w = pixelToWorld(l, x, y);
    this.hover.x = x;
    this.hover.y = y;
    this.hover.worldX = w.x;
    this.hover.worldY = w.y;
    this.hover.menuItem = menuItemAt(l.menu, x, y);
    this.hover.hud = hudButtonAt(l, s, x, y);
    this.hover.onBoard =
      x >= l.board.x && x < l.board.x + l.boardW && y >= l.board.y && y < l.board.y + l.boardH;
    this.hover.col = this.hover.onBoard ? Math.floor(w.x) : -1;
    this.hover.row = this.hover.onBoard ? Math.floor(w.y) : -1;
    this.hover.overRestart = modalRestartAt(l, s, x, y);
    pointerMove(s, w.x, w.y);
  };

  private onDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      cancelSelection(this.ctx.state());
      return;
    }
    if (e.button !== 0) return;

    const s = this.ctx.state();
    const l = this.ctx.layout();
    const { x, y } = this.localPoint(e);

    // A desktop pop-up's close box, drawn outside the board window.
    if (s.popup && pointInRect(popupCloseRect(s.popup), x, y)) {
      dismissPopup(s, s.popup.id);
      return;
    }

    if (s.phase === 'halted' || s.phase === 'victory') {
      if (modalRestartAt(l, s, x, y)) this.ctx.restart();
      return;
    }

    const hud = hudButtonAt(l, s, x, y);
    if (hud) {
      this.dispatch(hud, s);
      return;
    }

    const w = pixelToWorld(l, x, y);
    const onBoard = x >= l.board.x && x < l.board.x + l.boardW && y >= l.board.y && y < l.board.y + l.boardH;

    if (onBoard) {
      const col = Math.floor(w.x);
      const row = Math.floor(w.y);
      const tower = towerAt(s, col, row);
      if (tower) {
        selectPlacedTower(s, tower);
        return;
      }
      if (s.phase === 'wave' && enemyAt(s, w.x, w.y)) {
        pointerDown(s, w.x, w.y);
        return;
      }
      if (s.selected) {
        if (!placeTower(s, s.selected, col, row)) {
          this.ctx.notice(refusalReason(s, s.selected, col, row));
        }
        return;
      }
      if (s.selectedTowerId !== null) {
        cancelSelection(s);
        return;
      }
      if (s.phase === 'wave') pointerDown(s, w.x, w.y);
      return;
    }

    if (s.phase === 'wave') pointerDown(s, w.x, w.y);
  };

  private dispatch(hud: HudAction, s: RunState): void {
    switch (hud) {
      case 'gun':
      case 'cannon':
      case 'taser':
      case 'frost':
      case 'laser':
      case 'beacon':
        selectTower(s, hud);
        break;
      case 'pointer':
        upgradePointer(s);
        break;
      case 'wave':
        startWave(s);
        break;
      case 'upgrade': {
        const tower = selectedTower(s);
        if (tower) upgradeTower(s, tower.col, tower.row);
        break;
      }
      case 'branchA':
      case 'branchB': {
        const tower = selectedTower(s);
        if (tower) chooseBranch(s, tower.col, tower.row, hud === 'branchA' ? 'A' : 'B');
        break;
      }
      case 'sell': {
        const tower = selectedTower(s);
        if (tower) sellTower(s, tower.col, tower.row);
        break;
      }
    }
  }

  private onUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    pointerUp(this.ctx.state());
  };

  private onContext = (e: Event): void => {
    e.preventDefault();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      cancelSelection(this.ctx.state());
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= TOWER_KINDS.length) {
      selectTower(this.ctx.state(), TOWER_KINDS[n - 1]);
    }
  };
}
