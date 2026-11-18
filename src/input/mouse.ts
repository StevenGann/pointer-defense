import type { Application } from 'pixi.js';
import { menuItemAt, menuNameAt, pixelToWorld, pointInRect, type Layout, type MenuName } from '../view/chrome.ts';
import { hudButtonAt, hudControlAt, modalRestartAt, victoryButtonAt, type HudAction } from '../view/hud.ts';
import { adCloseRect } from '../view/ad.ts';
import { menuEntryAt, type OpenMenu } from '../view/menu.ts';
import { dialogButtonAt, type DialogModel } from '../view/dialog.ts';
import { dismissAd } from '../core/ads.ts';
import { popupCloseHit } from '../view/popupEnemy.ts';
import { canAfford } from '../core/economy.ts';
import { tileAt } from '../core/grid.ts';
import {
  gateLockRemainingSeconds,
  isGateLocked,
  isToggleGate,
  isTowerUnlocked,
  towerUnlockWave,
  TOWER_KINDS,
  TOWER_STATS,
  isTowerKind,
  type TowerKind,
} from '../core/towers.ts';
import { type SpecKind } from '../core/save.ts';
import {
  cancelSelection,
  chooseBranch,
  closePopupEnemy,
  cycleLevel,
  cycleTargetMode,
  enemyAt,
  noBuildActive,
  NO_BUILD_MESSAGE,
  placeTower,
  placementSealsUnderToggles,
  pointerDown,
  pointerMove,
  pointerUp,
  selectedTower,
  selectPlacedTower,
  selectTower,
  sellTower,
  startRepair,
  startWave,
  toggleAtTile,
  toggleGate,
  toggleManualOverride,
  togglePause,
  toggleSpeed,
  towerAt,
  upgradePointer,
  upgradeTower,
  killAllEnemies,
  toggleGodMode,
  type RunState,
} from '../core/state.ts';
import { cheatsEnabled } from '../core/cheats.ts';

/**
 * Hit testing and gestures against the run state, the menus and the modal dialogs. Tracks the
 * hover state (which the views read) and translates raw mouse events into core reducers and into
 * the wiring callbacks that own the meta-game (specs, profile, menus, dialogs).
 *
 * This controller only drives a live run; when the app is on the main menu or the editor, every
 * event here bails out early and those screens own their input.
 */

export type Screen = 'menu' | 'run' | 'editor';

export interface HoverState {
  x: number;
  y: number;
  menuItem: number;
  menuHover: string | null;
  dialogButton: string | null;
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
  menu: () => OpenMenu | null;
  dialog: () => DialogModel | null;
  screen: () => Screen;
  restart: () => void;
  restartWindows: () => void;
  startEndless: () => void;
  newRun: () => void;
  openMenu: (name: MenuName | null) => void;
  menuAction: (id: string) => void;
  dialogAction: (id: string) => void;
  closeDialog: () => void;
  exitRun: () => void;
  buySpec: (kind: SpecKind) => void;
  toggleAutoWave: () => void;
  notice: (message: string) => void;
  helpOpen: () => boolean;
  helpPointerDown: (x: number, y: number, button: number) => boolean;
  helpPointerMove: (x: number, y: number) => void;
  helpPointerUp: () => void;
  closeHelp: () => void;
}

/** HUD actions the No-Build modifier disables (placing, upgrading, branching, selling, repairing,
 *  and retargeting). Used to surface a status message when a greyed button is clicked anyway. */
const NO_BUILD_HUD_ACTIONS: ReadonlySet<HudAction> = new Set<HudAction>([
  // Every tower kind, from the one list that defines them, so a new tower is covered without an edit here.
  ...TOWER_KINDS,
  'upgrade',
  'branchA',
  'branchB',
  'branchC',
  'sell',
  'target',
]);

function refusalReason(s: RunState, kind: TowerKind, col: number, row: number): string {
  if (noBuildActive(s)) return NO_BUILD_MESSAGE;
  if (tileAt(s.grid, col, row) !== 'buildable') return 'That tile is blocked.';
  if (toggleAtTile(s, col, row)) return 'That tile is a shutter and cannot be built on.';
  if (towerAt(s, col, row)) return 'There is already a tower there.';
  if (!canAfford(s.economy, TOWER_STATS[kind].cost)) return 'Not enough salvage for that tower.';
  if (placementSealsUnderToggles(s, col, row)) return 'That would seal the route when a shutter closes.';
  return 'That would seal the route.';
}

export class MouseController {
  readonly hover: HoverState = {
    x: 0,
    y: 0,
    menuItem: -1,
    menuHover: null,
    dialogButton: null,
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
    if (this.ctx.screen() !== 'run') {
      this.hover.menuHover = null;
      this.hover.dialogButton = null;
      this.hover.hud = null;
      this.hover.onBoard = false;
      this.hover.col = -1;
      this.hover.row = -1;
      this.hover.overRestart = false;
      return;
    }
    if (this.ctx.helpOpen()) this.ctx.helpPointerMove(x, y);

    const open = this.ctx.menu();
    this.hover.menuHover = open ? menuEntryAt(l.menu, open, x, y) : null;
    const dialog = this.ctx.dialog();
    this.hover.dialogButton = dialog ? dialogButtonAt(l, dialog, x, y) : null;
    this.hover.hud = hudButtonAt(l, s, x, y);
    this.hover.onBoard =
      x >= l.board.x && x < l.board.x + l.boardW && y >= l.board.y && y < l.board.y + l.boardH;
    this.hover.col = this.hover.onBoard ? Math.floor(w.x) : -1;
    this.hover.row = this.hover.onBoard ? Math.floor(w.y) : -1;
    this.hover.overRestart = modalRestartAt(l, s, x, y);
    pointerMove(s, w.x, w.y);
  };

  private onDown = (e: PointerEvent): void => {
    if (this.ctx.screen() !== 'run') return;

    const s = this.ctx.state();
    const l = this.ctx.layout();
    const { x, y } = this.localPoint(e);

    // The help window swallows any click inside it, left or right button, so a click there never
    // reaches the board, the HUD or the palette behind it.
    if (this.ctx.helpOpen() && this.ctx.helpPointerDown(x, y, e.button)) return;

    if (e.button === 2) {
      cancelSelection(s);
      return;
    }
    if (e.button !== 0) return;

    // A modal dialog captures all input except its own buttons.
    const dialog = this.ctx.dialog();
    if (dialog) {
      const id = dialogButtonAt(l, dialog, x, y);
      if (id) this.ctx.dialogAction(id);
      return;
    }

    // An open dropdown menu: an item fires, a click elsewhere closes it.
    const open = this.ctx.menu();
    if (open) {
      const id = menuEntryAt(l.menu, open, x, y);
      if (id) this.ctx.menuAction(id);
      else this.ctx.openMenu(null);
      return;
    }

    // A desktop ad's close box.
    if (s.ad && pointInRect(adCloseRect(s.ad), x, y)) {
      dismissAd(s, s.ad.id);
      return;
    }

    // Menu words open their dropdowns.
    const name = menuNameAt(l.menu, x, y);
    if (name) {
      this.ctx.openMenu(name);
      return;
    }

    if (s.phase === 'victory') {
      const vb = victoryButtonAt(l, s, x, y);
      if (vb === 'endless') this.ctx.startEndless();
      else if (vb === 'restart') this.ctx.restartWindows();
      return;
    }
    if (s.phase === 'halted') {
      if (modalRestartAt(l, s, x, y)) this.ctx.restart();
      return;
    }

    const hud = hudButtonAt(l, s, x, y);
    if (hud) {
      this.dispatch(hud, s);
      return;
    }
    const control = hudControlAt(l, s, x, y);
    if (control && !control.enabled) {
      if (noBuildActive(s) && NO_BUILD_HUD_ACTIONS.has(control.action)) {
        this.ctx.notice(NO_BUILD_MESSAGE);
        return;
      }
      const kind = control.action as TowerKind;
      if (TOWER_KINDS.includes(kind) && !isTowerUnlocked(kind, s.wave)) {
        this.ctx.notice(`${TOWER_STATS[kind].name} unlocks at wave ${towerUnlockWave(kind)}`);
        return;
      }
    }

    const w = pixelToWorld(l, x, y);
    const onBoard = x >= l.board.x && x < l.board.x + l.boardW && y >= l.board.y && y < l.board.y + l.boardH;

    if (onBoard) {
      // The pop-up's close box is the one place a click kills it; it wins over towers and enemies.
      const popup = s.enemies.find((e) => e.kind === 'popup' && !e.dead && popupCloseHit(e, l.board, x, y));
      if (popup) {
        closePopupEnemy(s, popup.id);
        return;
      }
      const col = Math.floor(w.x);
      const row = Math.floor(w.y);
      const tower = towerAt(s, col, row);
      if (tower) {
        selectPlacedTower(s, tower);
        if (isToggleGate(tower)) {
          if (isGateLocked(tower, s.clock)) {
            this.ctx.notice(`Gate locked for ${gateLockRemainingSeconds(tower, s.clock).toFixed(1)} s`);
          } else if (!toggleGate(s, col, row)) {
            this.ctx.notice('That would seal the route.');
          }
        }
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
    // Every tower kind in the palette selects a tower. Driving this off TOWER_KINDS rather than a hand
    // written case list is what stops a new tower from being drawn but unclickable: the AA tower shipped
    // with a button and no case here, so its clicks fell through the switch and did nothing.
    if (isTowerKind(hud)) {
      selectTower(s, hud);
      return;
    }
    switch (hud) {
      case 'pointer':
        upgradePointer(s);
        break;
      case 'override':
        toggleManualOverride(s);
        break;
      case 'auto':
        this.ctx.toggleAutoWave();
        break;
      case 'wave':
        startWave(s);
        break;
      case 'map':
        cycleLevel(s);
        break;
      case 'upgrade': {
        const tower = selectedTower(s);
        if (tower) upgradeTower(s, tower.col, tower.row);
        break;
      }
      case 'branchA':
      case 'branchB':
      case 'branchC': {
        const tower = selectedTower(s);
        if (tower) chooseBranch(s, tower.col, tower.row, hud === 'branchA' ? 'A' : hud === 'branchB' ? 'B' : 'C');
        break;
      }
      case 'sell': {
        const tower = selectedTower(s);
        if (tower) sellTower(s, tower.col, tower.row);
        break;
      }
      case 'repairTower': {
        const tower = selectedTower(s);
        if (tower) startRepair(s, tower.col, tower.row);
        break;
      }
      case 'target': {
        const tower = selectedTower(s);
        if (tower) cycleTargetMode(s, tower.col, tower.row);
        break;
      }
      case 'buyCpu':
        this.ctx.buySpec('cpu');
        break;
      case 'buyRam':
        this.ctx.buySpec('ram');
        break;
      case 'buyGpu':
        this.ctx.buySpec('gpu');
        break;
      case 'buyDisk':
        this.ctx.buySpec('disk');
        break;
    }
  }

  private onUp = (e: PointerEvent): void => {
    if (this.ctx.screen() !== 'run') return;
    if (this.ctx.helpOpen()) this.ctx.helpPointerUp();
    if (e.button !== 0) return;
    pointerUp(this.ctx.state());
  };

  private onContext = (e: Event): void => {
    e.preventDefault();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (this.isTypingTarget(e.target)) return;
    if (this.ctx.screen() !== 'run') return;

    if (e.key === 'Escape') {
      const s = this.ctx.state();
      // A modal dialog or open menu closes first, then the help viewer, then the run exits.
      const modalOpen = this.ctx.menu() !== null || this.ctx.dialog() !== null;
      if (modalOpen) {
        this.ctx.openMenu(null);
        this.ctx.closeDialog();
        cancelSelection(s);
        return;
      }
      if (this.ctx.helpOpen()) {
        this.ctx.closeHelp();
        return;
      }
      const hadSelection = s.selected !== null || s.selectedTowerId !== null;
      cancelSelection(s);
      if (!hadSelection) this.ctx.exitRun();
      return;
    }

    const s = this.ctx.state();
    if (this.ctx.menu() || this.ctx.dialog()) return;

    // Cheat shortcuts: Ctrl+Shift+G toggles God Mode, Ctrl+Shift+K kills all. They read the same
    // gate as the menu, so with cheats hidden they are inert.
    if (cheatsEnabled() && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        toggleGodMode(s);
        return;
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        killAllEnemies(s);
        return;
      }
    }

    if (e.key === 'p' || e.key === 'P') {
      togglePause(s);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      toggleSpeed(s);
      return;
    }
    if (e.key === 'u' || e.key === 'U') {
      const tower = selectedTower(s);
      if (tower) {
        if (noBuildActive(s)) this.ctx.notice(NO_BUILD_MESSAGE);
        else upgradeTower(s, tower.col, tower.row);
      }
      return;
    }
    if (e.key === 'x' || e.key === 'X') {
      const tower = selectedTower(s);
      if (tower) {
        if (noBuildActive(s)) this.ctx.notice(NO_BUILD_MESSAGE);
        else sellTower(s, tower.col, tower.row);
      }
      return;
    }
    if (e.key === 'Enter') {
      if (s.phase === 'build') startWave(s);
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= TOWER_KINDS.length) {
      const kind = TOWER_KINDS[n - 1];
      if (!isTowerUnlocked(kind, s.wave)) {
        this.ctx.notice(`${TOWER_STATS[kind].name} unlocks at wave ${towerUnlockWave(kind)}`);
        return;
      }
      selectTower(s, kind);
    }
  };

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
      target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    );
  }
}
