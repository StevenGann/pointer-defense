import type { Application } from 'pixi.js';
import { menuItemAt, pixelToWorld, type Layout } from '../view/chrome.ts';
import { hudButtonAt, modalRestartAt, type HudAction } from '../view/hud.ts';
import {
  cancelSelection,
  enemyAt,
  placeTower,
  pointerDown,
  pointerMove,
  pointerUp,
  selectTower,
  startWave,
  upgradePointer,
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

    if (s.selected && onBoard) {
      const enemy = s.phase === 'wave' ? enemyAt(s, w.x, w.y) : undefined;
      if (enemy) {
        pointerDown(s, w.x, w.y);
        return;
      }
      placeTower(s, s.selected, Math.floor(w.x), Math.floor(w.y));
      return;
    }

    if (s.phase === 'wave') pointerDown(s, w.x, w.y);
  };

  private dispatch(hud: HudAction, s: RunState): void {
    switch (hud) {
      case 'gun':
      case 'cannon':
      case 'taser':
        selectTower(s, hud);
        break;
      case 'pointer':
        upgradePointer(s);
        break;
      case 'wave':
        startWave(s);
        break;
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
    if (e.key === 'Escape') cancelSelection(this.ctx.state());
  };
}
