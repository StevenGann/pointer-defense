import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import {
  buySpec,
  createRunState,
  enterEndless,
  restartWindows,
  selectedTower,
  step,
  towerAt,
  type RunState,
} from './core/state.ts';
import { loadProfile, saveProfile, specGain, type Profile, type SpecKind } from './core/save.ts';
import { achievementName, ACHIEVEMENTS } from './core/achievements.ts';
import { ChromeView, computeLayout, PAL, pointInRect, type Layout } from './view/chrome.ts';
import { BoardView } from './view/board.ts';
import { HudView, hudControlAt, paletteTowerAt, type HudAction } from './view/hud.ts';
import { paletteTooltipLines, TooltipView, towerTooltipLines } from './view/tooltip.ts';
import {
  branchTooltipLines,
  pointerTooltipLines,
  repairTooltipLines,
  sellTooltipLines,
  specTooltipLines,
  targetLockReason,
  upgradeTooltipLines,
  type TooltipLine,
} from './view/tooltipText.ts';
import { PopupView } from './view/popup.ts';
import { FloatingNumbersView } from './view/numbers.ts';
import { MenuView, type OpenMenu } from './view/menu.ts';
import { DialogView, type DialogModel } from './view/dialog.ts';
import { MouseController } from './input/mouse.ts';
import { EffectsView } from './view/effects.ts';
import { sfx, type SoundName } from './audio/sfx.ts';
import type { Branch, TowerKind } from './core/towers.ts';
import pkg from '../package.json';

const app = new Application();
await app.init({
  background: PAL.desktop,
  resizeTo: window,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.getElementById('app')!.appendChild(app.canvas);
app.canvas.style.cursor = 'none';

let profile: Profile = loadProfile();
let state: RunState = createRunState(profile);
let layout: Layout = computeLayout(app.screen.width, app.screen.height);

const chrome = new ChromeView();
const board = new BoardView();
const effects = new EffectsView();
const hud = new HudView();
const popup = new PopupView();
const numbers = new FloatingNumbersView();
const menuView = new MenuView();
const dialogView = new DialogView();
const tooltip = new TooltipView();

const root = new Container();
app.stage.addChild(root);
root.addChild(chrome.root, board.root, effects.root, numbers.root, hud.root, popup.root, menuView.root, dialogView.root, tooltip.root);

sfx.setEnabled(profile.soundOn);
sfx.setVolume(profile.volume);
// Audio may only start inside a user gesture, so create the context on the first click or key.
app.canvas.addEventListener('pointerdown', () => sfx.ensure());
window.addEventListener('keydown', () => sfx.ensure());

let menu: OpenMenu | null = null;
let dialog: DialogModel | null = null;

function syncViewport(): void {
  state.viewport = {
    width: app.screen.width,
    height: app.screen.height,
    window: { x: layout.window.x, y: layout.window.y, w: layout.window.w, h: layout.window.h },
    rightPanel: {
      x: layout.rightPanel.x,
      y: layout.rightPanel.y,
      w: layout.rightPanel.w,
      h: layout.rightPanel.h,
    },
  };
}
syncViewport();

const cursor = new Graphics();
drawCursorArrow(cursor);
root.addChild(cursor);

function drawCursorArrow(g: Graphics): void {
  g.clear();
  g.poly([0, 0, 0, 13, 3.5, 10, 5.5, 16, 8, 14, 6.5, 10, 11, 10])
    .fill(PAL.highlight)
    .stroke({ width: 1, color: PAL.dark });
}

// --- Meta-game wiring ---------------------------------------------------------------------------

function syncProfileMeta(): void {
  profile.specs = { ...state.specs };
  profile.unspentSpecs = state.unspentSpecs;
  profile.achievements = Array.from(state.achievements);
}

function toastAchievement(id: string): void {
  hud.showNotice(`Achievement: ${achievementName(id)}`, 180);
}

/** Push any achievement unlocked in the sim this frame into the profile and toast it. */
function syncAchievements(): void {
  let changed = false;
  for (const id of state.achievements) {
    if (!profile.achievements.includes(id)) {
      profile.achievements.push(id);
      toastAchievement(id);
      changed = true;
    }
  }
  if (changed) saveProfile(profile);
}

/** Record the highest wave reached, persisted to the profile as soon as it moves. */
function syncBestWave(): void {
  if (state.wave > profile.bestWave) {
    profile.bestWave = state.wave;
    saveProfile(profile);
  }
}

function doRestartWindows(): void {
  const { profile: next } = restartWindows(state, profile);
  const newly = next.achievements.filter((id) => !profile.achievements.includes(id));
  profile = next;
  saveProfile(profile);
  state = createRunState(profile);
  syncViewport();
  dialog = null;
  menu = null;
  for (const id of newly) toastAchievement(id);
}

function doNewRun(): void {
  state = createRunState(profile);
  syncViewport();
  dialog = null;
  menu = null;
}

function openMenu(name: 'file' | 'help' | null): void {
  menu = name ? buildMenu(name) : null;
}

function buildMenu(name: 'file' | 'help'): OpenMenu {
  if (name === 'help') {
    return {
      name,
      entries: [
        { id: 'sound', label: profile.soundOn ? 'Sound: On' : 'Sound: Off' },
        { id: 'volumeLow', label: 'Volume: Low', checked: profile.volume === 'low' },
        { id: 'volumeMed', label: 'Volume: Medium', checked: profile.volume === 'med' },
        { id: 'volumeHigh', label: 'Volume: High', checked: profile.volume === 'high' },
        { id: 'separator', label: '', separator: true },
        { id: 'achievements', label: 'Achievements' },
        { id: 'about', label: 'About' },
      ],
    };
  }
  const ready = state.wave >= 50;
  return {
    name,
    entries: [
      { id: 'restart', label: ready ? 'Restart Windows' : 'Restart Windows (wave 50)', disabled: !ready },
      { id: 'new-run', label: 'New Run' },
      { id: 'separator', label: '', separator: true },
      { id: 'exit', label: 'Exit' },
    ],
  };
}

function menuAction(id: string): void {
  menu = null;
  switch (id) {
    case 'restart':
      dialog = {
        title: 'Restart Windows',
        rows: [{ text: `This closes the run and banks ${specGain(state.economy.earned)} specs.` }],
        buttons: [
          { id: 'restart', label: 'Restart' },
          { id: 'cancel', label: 'Cancel' },
        ],
      };
      break;
    case 'new-run':
      dialog = {
        title: 'New Run',
        rows: [{ text: 'Start a new run? This discards the current run.' }],
        buttons: [
          { id: 'new-run', label: 'OK' },
          { id: 'cancel', label: 'Cancel' },
        ],
      };
      break;
    case 'exit':
      break;
    case 'achievements':
      dialog = {
        title: 'Achievements',
        rows: ACHIEVEMENTS.map((a) => ({
          text: a.name,
          greyed: !state.achievements.has(a.id),
        })),
        buttons: [{ id: 'close', label: 'Close' }],
      };
      break;
    case 'about':
      dialog = {
        title: 'About',
        rows: [{ text: `${pkg.name} v${pkg.version}` }, { text: pkg.description }],
        buttons: [{ id: 'close', label: 'Close' }],
      };
      break;
    case 'sound':
      profile.soundOn = !profile.soundOn;
      sfx.setEnabled(profile.soundOn);
      saveProfile(profile);
      break;
    case 'volumeLow':
    case 'volumeMed':
    case 'volumeHigh':
      profile.volume = id === 'volumeLow' ? 'low' : id === 'volumeHigh' ? 'high' : 'med';
      sfx.setVolume(profile.volume);
      saveProfile(profile);
      break;
  }
}

function dialogAction(id: string): void {
  if (id === 'restart') {
    doRestartWindows();
    return;
  }
  if (id === 'new-run') {
    doNewRun();
    return;
  }
  if (id === 'cancel' || id === 'close') {
    dialog = null;
  }
}

function closeDialog(): void {
  dialog = null;
}

const mouse = new MouseController(app, {
  layout: () => layout,
  state: () => state,
  menu: () => menu,
  dialog: () => dialog,
  restart: () => {
    state = createRunState(profile);
    syncViewport();
  },
  restartWindows: doRestartWindows,
  startEndless: () => {
    enterEndless(state);
  },
  newRun: doNewRun,
  openMenu,
  menuAction,
  dialogAction,
  closeDialog,
  buySpec: (kind: SpecKind) => {
    if (buySpec(state, kind)) {
      syncProfileMeta();
      saveProfile(profile);
    }
  },
  notice: (message) => hud.showNotice(message),
});

function towerSound(kind: TowerKind): SoundName {
  switch (kind) {
    case 'gun':
      return 'gun';
    case 'cannon':
      return 'cannon';
    case 'taser':
      return 'taser';
    case 'laser':
      return 'laser';
    case 'frost':
      return 'frost';
    case 'beacon':
      return 'cannon';
    case 'wall':
      return 'cannon';
    case 'cursor':
      return 'gun';
  }
}

/** Drain the sim's one-shot events into sound and view effects, clearing the queue each frame. */
function drainEvents(): void {
  if (state.events.length === 0) return;
  for (const ev of state.events) {
    switch (ev.type) {
      case 'shot': {
        const tower = state.towers.find((t) => t.id === ev.towerId);
        effects.addShot(tower, ev.x, ev.y);
        if (tower) sfx.play(towerSound(tower.kind));
        break;
      }
      case 'damage':
        effects.addHitFlash(ev.x, ev.y);
        numbers.addDamage(ev.x, ev.y, ev.amount, ev.weak, !!ev.crit, state.tick);
        break;
      case 'kill':
        effects.addDeath(ev.kind, ev.x, ev.y, ev.heading);
        sfx.play('kill', { pitch: 1 + 0.06 * Math.min(state.pointer.combo, 12) });
        break;
      case 'leak':
        sfx.play('leak');
        break;
      case 'waveStarted':
        sfx.play('waveStart');
        break;
      case 'waveCleared':
        sfx.play('waveClear');
        break;
      case 'wallDamaged':
        effects.addHitFlash(ev.x, ev.y);
        break;
      case 'wallDestroyed':
        effects.addHitFlash(ev.x, ev.y);
        sfx.play('cannon');
        break;
      case 'popupSpawned':
        sfx.play('popup');
        break;
      case 'popupDismissed':
        sfx.play('popupClose');
        break;
      case 'toggleChanged':
        hud.showNotice(`Shutter ${ev.index} ${ev.open ? 'opened' : 'closed'}`, 120);
        break;
      case 'click':
        break;
    }
  }
  state.events = [];
}

app.ticker.add((ticker) => {
  const alpha = step(state, ticker.deltaMS);
  drainEvents();
  syncAchievements();
  syncBestWave();
  chrome.draw(layout, mouse.hover.menuItem);
  menuView.draw(layout.menu, menu, mouse.hover.menuHover);
  board.draw(state, layout, alpha, { col: mouse.hover.col, row: mouse.hover.row, onBoard: mouse.hover.onBoard, x: mouse.hover.x, y: mouse.hover.y });
  effects.draw(state, layout);
  numbers.draw(state, layout);
  hud.draw(state, layout, mouse.hover.hud);
  popup.draw(state);
  dialogView.draw(dialog, layout);
  updateTooltip();
  cursor.position.set(mouse.hover.x, mouse.hover.y);
});

/** The tooltip lines for a HUD spend control, computed from the same functions the click applies. */
function hudTooltipLines(action: HudAction, s: RunState): TooltipLine[] {
  const tower = selectedTower(s);
  switch (action) {
    case 'pointer':
      return pointerTooltipLines(s.pointer, s.economy.salvage);
    case 'override':
      return ['Manual Override: every tower in range of the marked enemy drops its own priority and shoots it.'];
    case 'upgrade':
      return tower ? upgradeTooltipLines(tower, s.economy.salvage) : [];
    case 'branchA':
    case 'branchB':
    case 'branchC': {
      if (!tower) return [];
      const branch: Branch = action === 'branchA' ? 'A' : action === 'branchB' ? 'B' : 'C';
      return branchTooltipLines(tower, branch, s.economy.salvage);
    }
    case 'sell':
      return tower ? sellTooltipLines(tower) : [];
    case 'repair':
      return tower ? repairTooltipLines(tower, s.clock, s.economy.salvage) : [];
    case 'target': {
      if (!tower) return [];
      const reason = targetLockReason(tower.kind);
      return reason === null ? [] : [reason];
    }
    case 'buyCpu':
    case 'buyRam':
    case 'buyGpu':
    case 'buyDisk': {
      const kind: SpecKind = action === 'buyCpu' ? 'cpu' : action === 'buyRam' ? 'ram' : action === 'buyGpu' ? 'gpu' : 'disk';
      return specTooltipLines(kind, s.specs[kind], s.unspentSpecs);
    }
    default:
      return [];
  }
}

/** Decide what the pointer is over and hand the tooltip its content (or nothing). */
function updateTooltip(): void {
  const h = mouse.hover;
  const suppressed =
    state.selected !== null || // placing a tower
    menu !== null || // dropdown open
    dialog !== null || // modal open
    h.menuItem >= 0 || // over the menu bar
    state.phase === 'halted' ||
    state.phase === 'victory' ||
    (state.popup !== null && pointInRect(state.popup, h.x, h.y)); // over a pop-up

  const viewportW = app.screen.width;
  const viewportH = app.screen.height;

  if (!suppressed) {
    const palette = paletteTowerAt(layout, state, h.x, h.y);
    if (palette !== null) {
      tooltip.update({ key: `palette:${palette}`, lines: paletteTooltipLines(palette) }, h.x, h.y, viewportW, viewportH);
      return;
    }
    const tower = h.onBoard ? towerAt(state, h.col, h.row) : undefined;
    if (tower) {
      tooltip.update({ key: `tower:${tower.id}`, lines: towerTooltipLines(tower, state.clock, state.pointer, state.specs) }, h.x, h.y, viewportW, viewportH);
      return;
    }
    const control = hudControlAt(layout, state, h.x, h.y);
    if (control) {
      const lines = hudTooltipLines(control.action, state);
      if (lines.length > 0) {
        tooltip.update({ key: `hud:${control.action}`, lines }, h.x, h.y, viewportW, viewportH);
        return;
      }
    }
  }

  tooltip.update({ key: null, lines: [] }, h.x, h.y, viewportW, viewportH);
}

app.renderer.on('resize', () => {
  layout = computeLayout(app.screen.width, app.screen.height);
  syncViewport();
});
