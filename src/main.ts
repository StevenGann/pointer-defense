import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import {
  buySpec,
  createRunState,
  enterEndless,
  restartWindows,
  step,
  type RunState,
} from './core/state.ts';
import { loadProfile, saveProfile, specGain, type Profile, type SpecKind } from './core/save.ts';
import { achievementName, ACHIEVEMENTS } from './core/achievements.ts';
import { ChromeView, computeLayout, PAL, type Layout } from './view/chrome.ts';
import { BoardView } from './view/board.ts';
import { HudView } from './view/hud.ts';
import { PopupView } from './view/popup.ts';
import { FloatingNumbersView } from './view/numbers.ts';
import { MenuView, type OpenMenu } from './view/menu.ts';
import { DialogView, type DialogModel } from './view/dialog.ts';
import { MouseController } from './input/mouse.ts';
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
const hud = new HudView();
const popup = new PopupView();
const numbers = new FloatingNumbersView();
const menuView = new MenuView();
const dialogView = new DialogView();

const root = new Container();
app.stage.addChild(root);
root.addChild(chrome.root, board.root, numbers.root, hud.root, popup.root, menuView.root, dialogView.root);

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

app.ticker.add((ticker) => {
  const alpha = step(state, ticker.deltaMS);
  syncAchievements();
  syncBestWave();
  chrome.draw(layout, mouse.hover.menuItem);
  menuView.draw(layout.menu, menu, mouse.hover.menuHover);
  board.draw(state, layout, alpha, { col: mouse.hover.col, row: mouse.hover.row, onBoard: mouse.hover.onBoard });
  numbers.draw(state, layout);
  hud.draw(state, layout, mouse.hover.hud);
  popup.draw(state);
  dialogView.draw(dialog, layout);
  cursor.position.set(mouse.hover.x, mouse.hover.y);
});

app.renderer.on('resize', () => {
  layout = computeLayout(app.screen.width, app.screen.height);
  syncViewport();
});
