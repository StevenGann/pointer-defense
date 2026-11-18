import { Application, Container, Graphics, Sprite } from 'pixi.js';
import './style.css';
import {
  buySpec,
  cancelSelection,
  createRunState,
  cursorMaintenanceStatus,
  enemyAt,
  enterEndless,
  killAllEnemies,
  noBuildActive,
  NO_BUILD_MESSAGE,
  restartWindows,
  selectedTower,
  spawnCheatEnemy,
  step,
  toggleAutoWave,
  toggleGodMode,
  towerAt,
  type RunState,
} from './core/state.ts';
import { SPAWN_KINDS, spawnKindLabel } from './core/cheats.ts';
import { DEFAULT_LEVEL, type Level } from './core/levels.ts';
import { addSeenEnemies, checkProfileAchievements, loadProfile, saveProfile, specGain, type Profile, type SpecKind } from './core/save.ts';
import { achievementName, ACHIEVEMENTS } from './core/achievements.ts';
import { ChromeView, computeLayout, PAL, pixelToWorld, pointInRect, type Layout, type MenuName } from './view/chrome.ts';
import { BoardView } from './view/board.ts';
import { HudView, hudControlAt, paletteTowerAt, type HudAction } from './view/hud.ts';
import { paletteTooltipLines, TooltipView, towerTooltipLines } from './view/tooltip.ts';
import {
  branchTooltipLines,
  enemyTooltipLines,
  lockedPaletteLine,
  pointerTooltipLines,
  repairTooltipLines,
  sellTooltipLines,
  specTooltipLines,
  targetLockReason,
  upgradeTooltipLines,
  type TooltipLine,
} from './view/tooltipText.ts';
import { AdView } from './view/ad.ts';
import { FloatingNumbersView } from './view/numbers.ts';
import { MenuView, type OpenMenu } from './view/menu.ts';
import { DialogView, type DialogModel } from './view/dialog.ts';
import { HelpSession, HelpView, computeHelpLayout, helpHitAt, helpRows } from './view/help.ts';
import { MouseController, type Screen } from './input/mouse.ts';
import { EffectsView } from './view/effects.ts';
import { BossBarView } from './view/bossBars.ts';
import { sfx, type SoundName } from './audio/sfx.ts';
import { CameraShake, shakeImpulseFor } from './view/shake.ts';
import { backingStorePixelSize, cssViewportSize, liveDevicePixelRatio } from './view/screen.ts';
import { getArtTexture, onArtInvalidate, preloadArt, setArtDpr } from './view/art.ts';
import { repairHealingCount, TOWER_STATS, type Branch, type TowerKind } from './core/towers.ts';
import { isBossVariant, type EnemyKind } from './core/enemies.ts';
import { encodeLevel, decodeCode } from './core/codec.ts';
import {
  clearEditor,
  createEditor,
  editorLevel,
  editorPlayable,
  editorToggleAt,
  eraseEditor,
  paintEditor,
  redoEditor,
  selectEditorTool,
  setEditorToggle,
  undoEditor,
  type EditorModel,
} from './core/editor.ts';
import { LoadDialogView, menuButtonAt, MenuScreenView, loadDialogButtonAt, computeLoadDialog, type MenuButtonId } from './view/menuScreen.ts';
import { EditorView, editorPaletteAt, editorToggleNudgeAt, editorToolbarAt, type EditorAction, type ToggleNudge } from './view/editor.ts';
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

// --- Device pixel ratio ----------------------------------------------------------------------
// The backing store is created at the ratio in force at boot, but devicePixelRatio changes when the
// window moves to a display with another scale factor, when the OS scale changes, and when the
// browser zooms. Pixi's `resizeTo` only reacts to a window resize and never re-reads the ratio, so
// a ratio change leaves the canvas raster at the old density while the CSS size follows the new one
// — the upscale that blurs text and lines. Re-apply the live ratio whenever it drifts.
function applyResolution(): void {
  const dpr = liveDevicePixelRatio();
  setArtDpr(dpr);
  const size = cssViewportSize();
  const target = backingStorePixelSize(size.width, size.height, dpr);
  const current = backingStorePixelSize(app.screen.width, app.screen.height, app.renderer.resolution);
  if (target.width === current.width && target.height === current.height && dpr === app.renderer.resolution) {
    return;
  }
  app.renderer.resize(size.width, size.height, dpr);
}

function watchResolution(): void {
  applyResolution();
  window.addEventListener('resize', applyResolution);

  // The resolution media query flips exactly when devicePixelRatio changes; re-arm it for the new
  // ratio after each flip. A plain window resize does not always fire on a pure ratio change.
  let detach: (() => void) | null = null;
  const trackDpr = (): void => {
    detach?.();
    detach = null;
    try {
      const mq = window.matchMedia(`(resolution: ${liveDevicePixelRatio()}dppx)`);
      const onChange = (): void => {
        applyResolution();
        trackDpr();
      };
      mq.addEventListener('change', onChange);
      detach = () => mq.removeEventListener('change', onChange);
    } catch {
      // resolution media queries are not available everywhere; the resize listener still covers it.
    }
  };
  trackDpr();

  window.visualViewport?.addEventListener('resize', applyResolution);
}
watchResolution();

let profile: Profile = loadProfile();
let state: RunState = createRunState(profile);
let layout: Layout = computeLayout(app.screen.width, app.screen.height);

const shake = new CameraShake();
shake.setEnabled(profile.shakeOn);

const chrome = new ChromeView();
const board = new BoardView();
const effects = new EffectsView();
const bossBars = new BossBarView((seen) => {
  profile.seenBossKinds = seen;
  saveProfile(profile);
});
bossBars.syncSeen(profile.seenBossKinds);
const hud = new HudView();
const ad = new AdView();
const numbers = new FloatingNumbersView();
const menuView = new MenuView();
const dialogView = new DialogView();
const tooltip = new TooltipView();
const menuScreenView = new MenuScreenView();
const loadDialogView = new LoadDialogView();
const editorView = new EditorView();
const helpSession = new HelpSession();
const helpView = new HelpView();

// Art loads without blocking the first frame; when it (or a DPR change) invalidates, the board drops
// its cached procedural art and re-reads the texture lookup on the next frame.
onArtInvalidate(() => {
  board.invalidateArt();
  drawCursorArrow();
});
void preloadArt().then(() => drawCursorArrow());

const root = new Container();
app.stage.addChild(root);
root.addChild(chrome.root, board.root, effects.root, numbers.root, bossBars.root, hud.root, helpView.root, ad.root, menuView.root, dialogView.root, tooltip.root, menuScreenView.root, loadDialogView.root, editorView.root);

sfx.setEnabled(profile.soundOn);
sfx.setVolume(profile.volume);
// Audio may only start inside a user gesture, so create the context on the first click or key.
app.canvas.addEventListener('pointerdown', () => sfx.ensure());
window.addEventListener('keydown', () => sfx.ensure());

let menu: OpenMenu | null = null;
let dialog: DialogModel | null = null;
let cheatNotified: RunState | null = null;

// --- Screens ---------------------------------------------------------------------------------
// The app is one of three screens: the main menu, a live run, or the map editor. `runOrigin` says
// where a run came from, so Esc (or File > Exit) returns a Test run to the editor — drawing intact —
// and any other run to the menu.
let screen: Screen = profile.lastChoice === 'editor' ? 'editor' : profile.lastChoice === 'load' ? 'menu' : 'run';
let runOrigin: 'play' | 'load' | 'editor' = 'play';
const editor: EditorModel = createEditor();
let loadText = '';
let loadStatus = '';
let loadOpen = profile.lastChoice === 'load';

function syncViewport(): void {
  state.viewport = {
    width: app.screen.width,
    height: app.screen.height,
    window: { x: layout.window.x, y: layout.window.y, w: layout.window.w, h: layout.window.h },
    client: { x: layout.client.x, y: layout.client.y, w: layout.client.w, h: layout.client.h },
    boardCol: { x: layout.boardCol.x, y: layout.boardCol.y, w: layout.boardCol.w, h: layout.boardCol.h },
    leftPanel: { x: layout.leftPanel.x, y: layout.leftPanel.y, w: layout.leftPanel.w, h: layout.leftPanel.h },
    rightPanel: {
      x: layout.rightPanel.x,
      y: layout.rightPanel.y,
      w: layout.rightPanel.w,
      h: layout.rightPanel.h,
    },
  };
}
syncViewport();

const cursor = new Sprite();
cursor.anchor.set(0, 0);
cursor.visible = false;
const cursorFallback = new Graphics();
root.addChild(cursor, cursorFallback);

function drawCursorArrow(): void {
  const tex = getArtTexture('cursor-arrow', 16);
  if (tex !== null) {
    cursor.texture = tex;
    cursor.width = 16;
    cursor.height = 16;
    cursor.rotation = 0;
    cursor.alpha = 1;
    cursor.tint = 0xffffff;
    cursor.visible = true;
    cursorFallback.visible = false;
  } else {
    cursor.visible = false;
    cursorFallback.visible = true;
    cursorFallback.clear();
    cursorFallback
      .poly([0, 0, 0, 13, 3.5, 10, 5.5, 16, 8, 14, 6.5, 10, 11, 10])
      .fill(PAL.highlight)
      .stroke({ width: 1, color: PAL.dark });
  }
}
drawCursorArrow();

// --- Meta-game wiring ---------------------------------------------------------------------------

function syncProfileMeta(): void {
  profile.specs = { ...state.specs };
  profile.unspentSpecs = state.unspentSpecs;
  profile.achievements = Array.from(state.achievements);
}

function toastAchievement(id: string): void {
  hud.showNotice(`Achievement: ${achievementName(id)}`, 180);
}

/** Record any profile-only achievement (reboot count, help completion) and toast it. */
function syncProfileAchievements(): void {
  const newly = checkProfileAchievements(profile);
  if (newly.length === 0) return;
  for (const id of newly) {
    state.achievements.add(id);
    toastAchievement(id);
  }
  saveProfile(profile);
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
  const profileNewly = checkProfileAchievements(profile);
  saveProfile(profile);
  state = createRunState(profile);
  syncViewport();
  dialog = null;
  menu = null;
  for (const id of newly) toastAchievement(id);
  for (const id of profileNewly) toastAchievement(id);
}

function doNewRun(): void {
  state = createRunState(profile);
  syncViewport();
  dialog = null;
  menu = null;
}

function openMenu(name: MenuName | null): void {
  menu = name ? buildMenu(name) : null;
}

function buildMenu(name: MenuName): OpenMenu {
  if (name === 'view') {
    return {
      name,
      entries: [{ id: 'shake', label: profile.shakeOn ? 'Screen shake: On' : 'Screen shake: Off' }],
    };
  }
  if (name === 'cheats') {
    return {
      name,
      entries: [
        { id: 'god-mode', label: 'God Mode', checked: state.godMode },
        { id: 'kill-all', label: 'Kill All' },
      ],
      secondColumn: [
        { id: 'spawn-header', label: 'Spawn', disabled: true },
        ...SPAWN_KINDS.map((kind) => ({ id: `spawn:${kind}`, label: spawnKindLabel(kind) })),
      ],
    };
  }
  if (name === 'help') {
    return {
      name,
      entries: [
        { id: 'show-help', label: 'Show Help' },
        { id: 'separator', label: '', separator: true },
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
      exitRun();
      break;
    case 'achievements': {
      const unlockedCount = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id)).length;
      dialog = {
        title: 'Achievements',
        rows: [
          { text: `${unlockedCount} / ${ACHIEVEMENTS.length}` },
          ...ACHIEVEMENTS.map((a) => ({
            text: a.name,
            greyed: !profile.achievements.includes(a.id),
          })),
        ],
        buttons: [{ id: 'close', label: 'Close' }],
      };
      break;
    }
    case 'about':
      dialog = {
        title: 'About',
        rows: [{ text: `${pkg.name} v${pkg.version}` }, { text: pkg.description }],
        buttons: [{ id: 'close', label: 'Close' }],
      };
      break;
    case 'show-help':
      helpSession.show(layout);
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
    case 'shake':
      profile.shakeOn = !profile.shakeOn;
      shake.setEnabled(profile.shakeOn);
      saveProfile(profile);
      break;
    case 'god-mode':
      toggleGodMode(state);
      break;
    case 'kill-all':
      killAllEnemies(state);
      break;
    default:
      if (id.startsWith('spawn:')) {
        spawnCheatEnemy(state, id.slice('spawn:'.length) as EnemyKind);
      }
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

// --- Screen transitions -----------------------------------------------------------------------

function startRun(level: Level, origin: 'play' | 'load' | 'editor'): void {
  state = createRunState(profile, level);
  syncViewport();
  runOrigin = origin;
  screen = 'run';
  menu = null;
  dialog = null;
  loadOpen = false;
  loadInput.blur();
}

function startPlay(): void {
  profile.lastChoice = 'play';
  saveProfile(profile);
  startRun(DEFAULT_LEVEL, 'play');
}

function openEditorScreen(): void {
  profile.lastChoice = 'editor';
  saveProfile(profile);
  loadOpen = false;
  loadInput.blur();
  screen = 'editor';
}

function openLoadDialog(): void {
  profile.lastChoice = 'load';
  saveProfile(profile);
  loadText = '';
  loadStatus = '';
  loadOpen = true;
  screen = 'menu';
  loadInput.value = '';
  loadInput.focus();
}

function attemptLoad(): void {
  const result = decodeCode(loadText.trim());
  if (!result.ok) {
    loadStatus = result.reason;
    return;
  }
  loadInput.blur();
  startRun(result.level, 'load');
}

function testMap(): void {
  if (!editorPlayable(editor)) return;
  startRun(editorLevel(editor), 'editor');
}

function copyCode(): void {
  if (!editorPlayable(editor)) return;
  const code = encodeLevel(editorLevel(editor));
  try {
    void navigator.clipboard?.writeText(code);
  } catch {
    // clipboard may be unavailable; the editor status still confirms the code was produced.
  }
  showEditorNotice('Code copied');
}

/** Esc from a run: a Test run returns to the editor (drawing intact), anything else to the menu. */
function exitRun(): void {
  if (runOrigin === 'editor') {
    screen = 'editor';
  } else {
    screen = 'menu';
  }
  menu = null;
  dialog = null;
  cancelSelection(state);
}

let editorNotice = '';
let editorNoticeTimer: ReturnType<typeof setTimeout> | null = null;
function showEditorNotice(msg: string, ms = 2500): void {
  editorNotice = msg;
  if (editorNoticeTimer !== null) clearTimeout(editorNoticeTimer);
  editorNoticeTimer = setTimeout(() => {
    editorNotice = '';
  }, ms);
}

const mouse = new MouseController(app, {
  layout: () => layout,
  state: () => state,
  menu: () => menu,
  dialog: () => dialog,
  screen: () => screen,
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
  exitRun,
  buySpec: (kind: SpecKind) => {
    if (buySpec(state, kind)) {
      syncProfileMeta();
      saveProfile(profile);
    }
  },
  toggleAutoWave: () => {
    toggleAutoWave(state);
    profile.autoWave = state.autoWave;
    saveProfile(profile);
  },
  notice: (message) => hud.showNotice(message),
  helpOpen: () => helpSession.open,
  helpPointerDown: (x: number, y: number, button: number): boolean => {
    const hl = computeHelpLayout(helpSession.x, helpSession.y);
    const rows = helpRows(profile, helpSession.expanded);
    const hit = helpHitAt(hl, rows, x, y);
    if (hit === null) return false;
    if (button === 0) {
      switch (hit.type) {
        case 'close':
          helpSession.hide();
          break;
        case 'title':
          helpSession.startDrag(x, y);
          break;
        case 'toolbar':
          if (hit.action === 'back') helpSession.back();
          else if (hit.action === 'forward') helpSession.forward();
          else helpSession.contents();
          break;
        case 'tree':
          if (hit.row >= 0) helpSession.clickTree(rows[hit.row]);
          break;
        case 'page':
        case 'window':
          break;
      }
    }
    return true;
  },
  helpPointerMove: (x: number, y: number) => helpSession.dragTo(layout, x, y),
  helpPointerUp: () => helpSession.endDrag(),
  closeHelp: () => helpSession.hide(),
});

// --- Menu and editor input --------------------------------------------------------------------

let menuHover: MenuButtonId | null = null;
let loadHover: 'ok' | 'cancel' | null = null;
let editorActionHover: EditorAction | null = null;
let painting = false;

function canvasPoint(e: PointerEvent): { x: number; y: number } {
  const rect = app.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function boardHit(x: number, y: number): { col: number; row: number; onBoard: boolean } {
  const onBoard =
    x >= layout.board.x && x < layout.board.x + layout.boardW && y >= layout.board.y && y < layout.board.y + layout.boardH;
  const w = pixelToWorld(layout, x, y);
  return { col: Math.floor(w.x), row: Math.floor(w.y), onBoard };
}

function handleEditorAction(action: EditorAction): void {
  switch (action) {
    case 'undo':
      undoEditor(editor);
      break;
    case 'redo':
      redoEditor(editor);
      break;
    case 'clear':
      clearEditor(editor);
      break;
    case 'test':
      testMap();
      break;
    case 'copy':
      copyCode();
      break;
  }
}

function nudgeEditorToggle(nudge: ToggleNudge): void {
  const s = editor.selectedShutter;
  if (!s) return;
  const t = editorToggleAt(editor, s.col, s.row);
  if (!t) return;
  const step = 60;
  setEditorToggle(editor, s.col, s.row, nudge.field, t[nudge.field] + nudge.dir * step);
}

// The load-code text field: an invisible HTML input overlaid on the Pixi-drawn field, so paste and
// keyboard editing work natively while the look stays in the canvas. Pixi draws the text.
const loadInput = document.createElement('input');
loadInput.type = 'text';
loadInput.autocomplete = 'off';
loadInput.spellcheck = false;
loadInput.style.position = 'fixed';
loadInput.style.border = 'none';
loadInput.style.background = 'transparent';
loadInput.style.color = 'transparent';
loadInput.style.caretColor = '#000000';
loadInput.style.outline = 'none';
loadInput.style.padding = '0 4px';
loadInput.style.boxSizing = 'border-box';
loadInput.style.font = '13px Tahoma, Verdana, Geneva, sans-serif';
loadInput.style.display = 'none';
loadInput.style.zIndex = '10';
document.body.appendChild(loadInput);
loadInput.addEventListener('input', () => {
  loadText = loadInput.value;
  loadStatus = '';
});
loadInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptLoad();
  else if (e.key === 'Escape') {
    loadOpen = false;
    loadText = '';
    loadStatus = '';
    loadInput.blur();
  }
});

app.canvas.addEventListener('pointermove', (e) => {
  const { x, y } = canvasPoint(e);
  if (screen === 'menu') {
    menuHover = loadOpen ? null : menuButtonAt(layout, x, y);
    loadHover = loadOpen ? loadDialogButtonAt(layout, x, y) : null;
    return;
  }
  if (screen === 'editor') {
    editorActionHover = editorToolbarAt(layout, editor, x, y);
    const hit = boardHit(x, y);
    if (painting && hit.onBoard) {
      const refusal = paintEditor(editor, hit.col, hit.row);
      if (refusal) showEditorNotice(refusal);
    }
    return;
  }
});

app.canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  if (screen === 'menu') {
    if (loadOpen) {
      const btn = loadDialogButtonAt(layout, x, y);
      if (btn === 'ok') attemptLoad();
      else if (btn === 'cancel') {
        loadOpen = false;
        loadText = '';
        loadStatus = '';
        loadInput.blur();
      }
      return;
    }
    const btn = menuButtonAt(layout, x, y);
    if (btn === 'play') startPlay();
    else if (btn === 'editor') openEditorScreen();
    else if (btn === 'load') openLoadDialog();
    return;
  }
  if (screen === 'editor') {
    if (e.button === 2) {
      e.preventDefault();
      const hit = boardHit(x, y);
      if (hit.onBoard) eraseEditor(editor, hit.col, hit.row);
      return;
    }
    if (e.button !== 0) return;
    const tool = editorPaletteAt(layout, editor, x, y);
    if (tool) {
      selectEditorTool(editor, tool);
      return;
    }
    const action = editorToolbarAt(layout, editor, x, y);
    if (action) {
      handleEditorAction(action);
      return;
    }
    const nudge = editorToggleNudgeAt(layout, editor, x, y);
    if (nudge) {
      nudgeEditorToggle(nudge);
      return;
    }
    const hit = boardHit(x, y);
    if (hit.onBoard) {
      painting = true;
      const refusal = paintEditor(editor, hit.col, hit.row);
      if (refusal) showEditorNotice(refusal);
    }
    return;
  }
});

app.canvas.addEventListener('pointerup', (e) => {
  if (e.button === 0) painting = false;
});

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (typingTarget(e.target)) return;
  if (screen === 'menu') {
    if (loadOpen) {
      if (e.key === 'Escape') {
        loadOpen = false;
        loadText = '';
        loadStatus = '';
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'p' || e.key === 'P') startPlay();
    else if (e.key === 'e' || e.key === 'E') openEditorScreen();
    else if (e.key === 'l' || e.key === 'L') openLoadDialog();
    return;
  }
  if (screen === 'editor') {
    if (e.key === 'Escape') {
      screen = 'menu';
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey) redoEditor(editor);
      else undoEditor(editor);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      redoEditor(editor);
      return;
    }
    return;
  }
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
    case 'aa':
      return 'cannon';
    case 'beacon':
      return 'cannon';
    case 'repair':
      return 'gun';
    case 'wall':
      return 'cannon';
    case 'cursor':
      return 'gun';
  }
}

/** Drain the sim's one-shot events into sound and view effects, clearing the queue each frame. */
function drainEvents(): void {
  if (state.events.length === 0) return;
  let shakeAmplitude = 0;
  let shakeFreezeMs = 0;
  for (const ev of state.events) {
    const impulse = shakeImpulseFor(ev);
    if (impulse) {
      shakeAmplitude = Math.max(shakeAmplitude, impulse.amplitude);
      shakeFreezeMs = Math.max(shakeFreezeMs, impulse.freezeMs);
    }
    switch (ev.type) {
      case 'shot': {
        const tower = state.towers.find((t) => t.id === ev.towerId);
        effects.addShot(tower, ev.x, ev.y);
        if (tower) sfx.play(towerSound(tower.kind));
        break;
      }
      case 'damage': {
        // A shielded enemy (or a Bastion) shows a shield arc instead of a hit spark.
        const target = state.enemies.find((e) => e.id === ev.id);
        if (target && (target.kind === 'shielded' || target.kind === 'shielded-boss')) {
          effects.addShieldHit(ev.x, ev.y);
        } else {
          effects.addHitSpark(ev.x, ev.y);
        }
        if (ev.dirX !== undefined && ev.dirY !== undefined) {
          effects.addKnockback(ev.id, ev.dirX, ev.dirY, state.tick);
        }
        numbers.addDamage(ev.x, ev.y, ev.amount, ev.weak, !!ev.crit, state.tick);
        break;
      }
      case 'shieldHit':
        effects.addShieldHit(ev.x, ev.y);
        numbers.addShield(ev.x, ev.y, ev.absorbed, state.tick);
        break;
      case 'kill':
        effects.addDeath(ev.kind, ev.x, ev.y);
        sfx.play('kill', { pitch: 1 + 0.06 * Math.min(state.pointer.combo, 12) });
        break;
      case 'leak':
        sfx.play('leak');
        break;
      case 'popupEscaped':
        hud.showNotice('Pop-up left — no damage');
        break;
      case 'waveStarted':
        sfx.play('waveStart');
        break;
      case 'waveCleared':
        sfx.play('waveClear');
        break;
      case 'wallDamaged':
        effects.addHitSpark(ev.x, ev.y);
        break;
      case 'wallDestroyed':
        effects.addHitSpark(ev.x, ev.y);
        sfx.play('cannon');
        break;
      case 'turretShot':
        effects.addBreacherShot(ev.x, ev.y, ev.targetX, ev.targetY);
        effects.addHitSpark(ev.targetX, ev.targetY);
        sfx.play('gun');
        break;
      case 'towerOffline':
        effects.addHitSpark(ev.x, ev.y);
        sfx.play('cannon');
        break;
      case 'adSpawned':
        sfx.play('ad');
        break;
      case 'adDismissed':
        sfx.play('adClose');
        break;
      case 'toggleChanged':
        hud.showNotice(`Shutter ${ev.index} ${ev.open ? 'opened' : 'closed'}`, 120);
        break;
      case 'mineDetonated':
        effects.addHitSpark(ev.x, ev.y);
        sfx.play('cannon');
        break;
      case 'towerUnlocked':
        hud.showNotice(ev.kinds.map((k) => `${TOWER_STATS[k].name} unlocked`).join(', '));
        break;
      case 'enemySpawned':
        if (addSeenEnemies(profile, [ev.kind])) saveProfile(profile);
        break;
      case 'click':
        break;
    }
  }
  if (shakeAmplitude > 0) shake.impulse(shakeAmplitude, state.tick, shakeFreezeMs);
  state.events = [];
}

app.ticker.add((ticker) => {
  const running = screen === 'run';
  if (running) {
    const alpha = step(state, ticker.deltaMS);
    drainEvents();
    if (!state.cheatsUsed) {
      syncAchievements();
      syncBestWave();
      syncProfileAchievements();
    }
    if (state.cheatsUsed && cheatNotified !== state) {
      cheatNotified = state;
      hud.showNotice('Cheats active — this run will not be recorded', 240);
    }
    board.draw(
      state,
      layout,
      alpha,
      { col: mouse.hover.col, row: mouse.hover.row, onBoard: mouse.hover.onBoard, x: mouse.hover.x, y: mouse.hover.y },
      (id, tick) => effects.knockbackOffset(id, tick),
    );
    effects.draw(state, layout);
    numbers.draw(state, layout);
    bossBars.draw(state, layout, profile.shakeOn);
    hud.draw(state, layout, mouse.hover.hud);
    ad.draw(state);
    helpView.draw(helpSession, profile, mouse.hover.x, mouse.hover.y);
    dialogView.draw(dialog, layout);
    updateTooltip();
    const shakeOffset = shake.offset(state.tick);
    root.position.set(shakeOffset.x, shakeOffset.y);
  } else {
    root.position.set(0, 0);
  }

  chrome.draw(layout, running ? mouse.hover.menuItem : -1);
  menuView.draw(layout.menu, running ? menu : null, running ? mouse.hover.menuHover : null);

  // Per-screen content; run-only views are hidden on the menu and in the editor.
  board.root.visible = running;
  effects.root.visible = running;
  numbers.root.visible = running;
  bossBars.root.visible = running;
  hud.root.visible = running;
  helpView.root.visible = running && helpSession.open;
  ad.root.visible = running;
  menuView.root.visible = running;
  dialogView.root.visible = running;
  tooltip.root.visible = running;
  menuScreenView.root.visible = screen === 'menu';
  loadDialogView.root.visible = screen === 'menu' && loadOpen;
  editorView.root.visible = screen === 'editor';

  if (screen === 'menu') {
    menuScreenView.draw(layout, menuHover);
    if (loadOpen) {
      loadDialogView.draw(layout, loadText, loadStatus, loadHover);
      const d = computeLoadDialog(layout);
      loadInput.style.display = 'block';
      loadInput.style.left = `${d.field.x}px`;
      loadInput.style.top = `${d.field.y}px`;
      loadInput.style.width = `${d.field.w}px`;
      loadInput.style.height = `${d.field.h}px`;
    } else {
      loadInput.style.display = 'none';
    }
  } else if (screen === 'editor') {
    editorView.draw(layout, editor, { tool: null, action: editorActionHover }, editorNotice);
    loadInput.style.display = 'none';
  }

  cursor.position.set(mouse.hover.x, mouse.hover.y);
});

/** True when the pointer is over the help window, which sits above the board and HUD. */
function overHelpWindow(x: number, y: number): boolean {
  if (!helpSession.open) return false;
  const hl = computeHelpLayout(helpSession.x, helpSession.y);
  return pointInRect(hl.window, x, y);
}

/** The tooltip lines for a HUD spend control, computed from the same functions the click applies. */
function hudTooltipLines(action: HudAction, s: RunState): TooltipLine[] {
  const tower = selectedTower(s);
  switch (action) {
    case 'pointer':
      return pointerTooltipLines(s.pointer, s.economy.salvage, s.wave);
    case 'override':
      return noBuildActive(s)
        ? ['Manual Override: every tower in range of the marked enemy drops its own priority and shoots it.', 'No-Build: towers cannot be retargeted this wave.']
        : ['Manual Override: every tower in range of the marked enemy drops its own priority and shoots it.'];
    case 'auto':
      return ['Auto: start the next wave 1.5 s after the board clears (holds while a tower repairs).'];
    case 'upgrade':
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      return tower ? upgradeTooltipLines(tower, s.economy.salvage) : [];
    case 'branchA':
    case 'branchB':
    case 'branchC': {
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      if (!tower) return [];
      const branch: Branch = action === 'branchA' ? 'A' : action === 'branchB' ? 'B' : 'C';
      return branchTooltipLines(tower, branch, s.economy.salvage);
    }
    case 'sell':
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      return tower ? sellTooltipLines(tower) : [];
    case 'repairTower':
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      return tower ? repairTooltipLines(tower, s.clock, s.economy.salvage) : [];
    case 'target': {
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
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
    (state.ad !== null && pointInRect(state.ad, h.x, h.y)) || // over an ad
    overHelpWindow(h.x, h.y); // over the help viewer

  const viewportW = app.screen.width;
  const viewportH = app.screen.height;

  if (!suppressed) {
    const palette = paletteTowerAt(layout, state, h.x, h.y);
    if (palette !== null) {
      const lines = noBuildActive(state)
        ? [NO_BUILD_MESSAGE]
        : ((): TooltipLine[] => {
            const locked = lockedPaletteLine(palette, state.wave);
            const desc = paletteTooltipLines(palette);
            return locked === null ? desc : [locked, ...desc];
          })();
      tooltip.update({ key: `palette:${palette}`, lines }, h.x, h.y, viewportW, viewportH);
      return;
    }
    const hoveredEnemy = h.onBoard && state.phase === 'wave' ? enemyAt(state, h.worldX, h.worldY) : undefined;
    if (hoveredEnemy && isBossVariant(hoveredEnemy.kind)) {
      tooltip.update(
        { key: `enemy:${hoveredEnemy.id}`, lines: enemyTooltipLines(hoveredEnemy) },
        h.x,
        h.y,
        viewportW,
        viewportH,
      );
      return;
    }
    const tower = h.onBoard ? towerAt(state, h.col, h.row) : undefined;
    if (tower) {
      const healed = tower.kind === 'repair' ? repairHealingCount(state.towers, tower, state.clock) : 0;
      const maintenance = tower.kind === 'cursor' ? cursorMaintenanceStatus(state, tower) : null;
      tooltip.update(
        { key: `tower:${tower.id}`, lines: towerTooltipLines(tower, state.clock, state.pointer, state.specs, healed, maintenance) },
        h.x,
        h.y,
        viewportW,
        viewportH,
      );
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
  helpSession.reclamp(layout);
});
