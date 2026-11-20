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
  notifyAchievement,
  overclockCap,
  pointerDamageMult,
  restartPointsGained,
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
import { dailyAvailable, dailyDate, dailyFor, dailyMenuLabel, DAILY_WAVES } from './core/daily.ts';
import { addSeenEnemies, checkProfileAchievements, loadProfile, saveProfile, type Profile, type RunOutcome, type SpecKind } from './core/save.ts';
import { clearRunSave, loadRunSave, saveRun } from './core/runsave.ts';
import { appendDailyRun, appendRun, buildRunRecord } from './core/runs.ts';
import { buyNode, effectsFor, treeNodeById } from './core/tree.ts';
import { achievementName } from './core/achievements.ts';
import { unlockAchievement } from './steam.ts';
import { ChromeView, computeLayout, PAL, pixelToWorld, pointInRect, type Layout, type MenuName } from './view/chrome.ts';
import { BoardView } from './view/board.ts';
import { HudView, hudControlAt, paletteTowerAt, type HudAction } from './view/hud.ts';
import { paletteTooltipLines, TooltipView, towerTooltipLines } from './view/tooltip.ts';
import { computeUpgradesLayout, upgradeRowBuyable, upgradesHitAt, UpgradesSession, globalUpgradeTooltipLines, UpgradesView } from './view/upgrades.ts';
import { BUFF_LINES, buyUpgrade, GLOBAL_UPGRADES, type UpgradeId } from './core/upgrades.ts';
import {
  branchTooltipLines,
  enemyTooltipLines,
  lockedPaletteLine,
  pointerTooltipLines,
  repairTooltipLines,
  sellTooltipLines,
  targetLockReason,
  upgradeTooltipLines,
  type TooltipLine,
} from './view/tooltipText.ts';
import { AdView, TrayView } from './view/ad.ts';
import { FloatingNumbersView } from './view/numbers.ts';
import { MenuView, type OpenMenu } from './view/menu.ts';
import { AchievementGridView, AchievementSession, achievementGridHitAt, buildAchievementGrid, computeAchievementGrid, type AchievementGridModel } from './view/dialog.ts';
import { dialogButtonAt, DialogView, type DialogModel } from './view/dialog.ts';
import { HelpSession, HelpView, computeHelpLayout, helpHitAt, helpRows, HELP_LINE_H, HELP_SCROLL_LINES } from './view/help.ts';
import { RestoreView, computeRestoreLayout, restoreHitAt } from './view/restore.ts';
import { RecordsSession, RecordsView, computeRecordsLayout, recordsHitAt, RECORDS_ROW_H } from './view/records.ts';
import { MouseController, type Screen } from './input/mouse.ts';
import { EffectsView } from './view/effects.ts';
import { BossBarView } from './view/bossBars.ts';
import { sfx, type SoundName } from './audio/sfx.ts';
import { CameraShake, shakeImpulseFor } from './view/shake.ts';
import { backingStorePixelSize, cssViewportSize, liveDevicePixelRatio } from './view/screen.ts';
import { getArtTexture, onArtInvalidate, preloadArt, setArtDpr } from './view/art.ts';
import { repairHealingCount, TOWER_KINDS, TOWER_STATS, type Branch, type TowerKind } from './core/towers.ts';
import { isBossVariant, type EnemyKind } from './core/enemies.ts';
import { encodeLevel, decodeCode } from './core/codec.ts';
import {
  clearEditor,
  createEditor,
  editorIsEmpty,
  editorLevel,
  editorPlayable,
  editorToggleAt,
  editorValidation,
  eraseEditor,
  paintEditor,
  redoEditor,
  selectEditorTool,
  setEditorToggle,
  undoEditor,
  type EditorModel,
} from './core/editor.ts';
import {
  applyDraft,
  applyMapEntry,
  deleteLibraryMap,
  LIBRARY_MAX,
  loadEditorDraft,
  loadLibrary,
  replaceLibraryMap,
  sanitizeMapName,
  saveEditorDraft,
  saveLibrary,
  saveLibraryMap,
  type EditorMapEntry,
} from './core/editorstore.ts';
import { LoadDialogView, menuButtonAt, MenuScreenView, loadDialogButtonAt, computeLoadDialog, type MenuButtonId } from './view/menuScreen.ts';
import { HELP_PAGES, pageUnlocked } from './content/help.ts';
import { EditorView, editorPaletteAt, editorToggleNudgeAt, editorToolbarAt, type EditorAction, type ToggleNudge } from './view/editor.ts';
import { MapLibraryView, NameDialogView, computeMapLibrary, computeNameDialog, mapLibraryHitAt, nameDialogButtonAt, type MapLibraryHit, type MapLibraryMode } from './view/mapLibrary.ts';
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
// Pixi writes `style.cursor` itself when it wires up events, so the rule has to be important; the
// same rule is in index.html for the first frame, before this module runs.
app.canvas.style.setProperty('cursor', 'none', 'important');

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

// A run-in-progress save (docs/RUN-SAVE.md). `?nosave` disables saving entirely, for the tests and
// for debugging, and then no save is read either so a stale Continue never appears.
const nosave = new URLSearchParams(window.location.search).has('nosave');
/** The restored run shown by the menu's Continue button, or null when there is nothing to resume. */
let continueState: RunState | null = nosave ? null : loadRunSave(profile);
const SAVE_INTERVAL_TICKS = 120; // one write per two seconds of run time
let lastRunSaveClock = -1;

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
const trayView = new TrayView();
const numbers = new FloatingNumbersView();
const menuView = new MenuView();
const dialogView = new DialogView();
const tooltip = new TooltipView();
const menuScreenView = new MenuScreenView();
const loadDialogView = new LoadDialogView();
const editorView = new EditorView();
const mapLibraryView = new MapLibraryView();
const nameDialogView = new NameDialogView();
const helpSession = new HelpSession();
const helpView = new HelpView();
const recordsSession = new RecordsSession();
const recordsView = new RecordsView();
const restoreView = new RestoreView();
const upgradesSession = new UpgradesSession();
const upgradesView = new UpgradesView();
const achievementSession = new AchievementSession();
const achievementView = new AchievementGridView();

// Art loads without blocking the first frame; when it (or a DPR change) invalidates, the board drops
// its cached procedural art and re-reads the texture lookup on the next frame.
onArtInvalidate(() => {
  board.invalidateArt();
  drawCursorArrow();
});
void preloadArt().then(() => drawCursorArrow());

const root = new Container();
app.stage.addChild(root);
root.addChild(
  chrome.root,
  board.root,
  effects.root,
  numbers.root,
  bossBars.root,
  hud.root,
  helpView.root,
  restoreView.root,
  upgradesView.root,
  achievementView.root,
  ad.root,
  trayView.root,
  menuView.root,
  menuScreenView.root,
  loadDialogView.root,
  editorView.root,
  mapLibraryView.root,
  nameDialogView.root,
  recordsView.root,
  tooltip.root,
  dialogView.root,
);

sfx.setEnabled(profile.soundOn);
sfx.setVolume(profile.volume);
// Audio may only start inside a user gesture, so create the context on the first click or key.
app.canvas.addEventListener('pointerdown', () => sfx.ensure());
window.addEventListener('keydown', () => sfx.ensure());

let menu: OpenMenu | null = null;
let dialog: DialogModel | null = null;
let cheatNotified: RunState | null = null;
let restoreOpen = false;
/** The run the Global Upgrades dialog was last drawn for; a different run closes it. */
let upgradesState: RunState | null = null;

/**
 * Open the Global Upgrades dialog — never over another modal (docs/GLOBAL-UPGRADES.md §1): not over
 * an open menu, dialog, the Help viewer, the achievements grid, Restore, or the end-of-run modal.
 */
function openUpgrades(): void {
  if (menu !== null || dialog !== null || helpSession.open || achievementSession.open || restoreOpen) return;
  if (state.phase === 'halted' || state.phase === 'victory') return;
  upgradesSession.show();
}

/** Buy a global upgrade through the sim's one entry point, with the purchase blip on success. */
function buyGlobalUpgrade(id: UpgradeId): void {
  if (buyUpgrade(state, id)) sfx.play('adClose');
}

// --- Screens ---------------------------------------------------------------------------------
// The app is one of three screens: the main menu, a live run, or the map editor. `runOrigin` says
// where a run came from, so Esc (or File > Exit) returns a Test run to the editor — drawing intact —
// and any other run to the menu.
// A valid save lands on the menu so Continue is the primary action; otherwise boot follows the
// remembered choice (Play resumes the normal flow straight into a run).
let screen: Screen =
  continueState !== null ? 'menu' : profile.lastChoice === 'editor' ? 'editor' : profile.lastChoice === 'load' ? 'menu' : 'run';
let runOrigin: 'play' | 'load' | 'editor' = 'play';
const editor: EditorModel = createEditor();
/** The saved maps (docs/EDITOR-LIBRARY.md), newest first, loaded once at boot. */
let editorLib: EditorMapEntry[] = loadLibrary();
// Opening the editor restores the draft (docs/EDITOR-LIBRARY.md), so a reload never loses work.
{
  const draft = loadEditorDraft();
  if (draft !== null) applyDraft(editor, draft);
}
let loadText = '';
let loadStatus = '';
let loadOpen = profile.lastChoice === 'load';

// --- View/OS achievement state (group D: recorded via notifyAchievement) ----------------------
// Cumulative time a tooltip has been visible this run (shadow-hover).
let tooltipHoverMs = 0;
// Tower kinds whose tooltip has been opened this run (shadow-tooltip).
const tooltipTowerKinds = new Set<TowerKind>();
// OS battery below 10% at boot (shadow-flat-battery), resolved once.
let batteryLow = false;
// Whether this page load was a reload after a prior run (shadow-reload).
let reloadedAfterRun = false;
try {
  const nav = performance.getEntriesByType?.('navigation')?.[0] as { type?: string } | undefined;
  reloadedAfterRun = nav?.type === 'reload' && profile.bestWave > 0;
} catch {
  reloadedAfterRun = false;
}
void (async () => {
  try {
    const nav = (navigator as unknown as { getBattery?: () => Promise<{ level?: number }> }).getBattery;
    if (nav) {
      const b = await nav();
      batteryLow = (b.level ?? 1) <= 0.1;
    }
  } catch {
    batteryLow = false;
  }
})();

/** Grant an achievement outside the run sim (editor / menu actions), stamping and toasting it. */
function grantAchievement(id: string): void {
  if (profile.achievements.includes(id)) return;
  profile.achievements.push(id);
  state.achievements.add(id);
  stampEarnedDates([id]);
  saveProfile(profile);
  toastAchievement(id);
}

/** Reset the view-scoped notify trackers when a fresh run begins. */
function resetRunNotified(): void {
  tooltipTowerKinds.clear();
  tooltipHoverMs = 0;
}

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
  profile.rp = state.rp;
  profile.achievements = Array.from(state.achievements);
}

function buyTreeNode(id: string): void {
  const node = treeNodeById(id);
  if (!node || !buyNode(profile, node)) return;
  state.rp = profile.rp;
  state.tree = [...profile.tree];
  state.treeEffects = effectsFor(profile);
  saveProfile(profile);
}

function toastAchievement(id: string): void {
  hud.showNotice(`Achievement: ${achievementName(id)}`, 180);
  // The wrapper reports the unlock to Steam when it is live; a no-op in the browser.
  unlockAchievement(id);
}

/** The local date as YYYY-MM-DD, stamped onto an achievement when it fires. */
function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Stamp the earned date when an achievement first lands in the profile. */
function stampEarnedDates(ids: readonly string[]): void {
  for (const id of ids) if (profile.achievementDates[id] === undefined) profile.achievementDates[id] = todayISO();
}

/** Record any profile-only achievement (reboot count, help completion) and toast it. */
function syncProfileAchievements(): void {
  const newly = checkProfileAchievements(profile);
  if (newly.length === 0) return;
  for (const id of newly) {
    state.achievements.add(id);
    toastAchievement(id);
  }
  stampEarnedDates(newly);
  saveProfile(profile);
}

/** Push any achievement unlocked in the sim this frame into the profile and toast it. */
function syncAchievements(): void {
  let changed = false;
  const fresh: string[] = [];
  for (const id of state.achievements) {
    if (!profile.achievements.includes(id)) {
      profile.achievements.push(id);
      fresh.push(id);
      toastAchievement(id);
      changed = true;
    }
  }
  if (changed) {
    stampEarnedDates(fresh);
    saveProfile(profile);
  }
}

/** Record the highest wave reached, persisted to the profile as soon as it moves. */
function syncBestWave(): void {
  if (state.wave > profile.bestWave) {
    profile.bestWave = state.wave;
    saveProfile(profile);
  }
}

/** Append a finished-run record (docs/RUN-RECORDS.md); a cheated run records nothing. */
function recordRun(outcome: RunOutcome): void {
  if (state.cheatsUsed) return;
  appendRun(profile, buildRunRecord(state, outcome));
  saveProfile(profile);
}

/**
 * Record a finished daily (docs/DAILY.md): one record with `outcome: 'daily'` plus the date and
 * seed, mirrored to `profile.daily` so the menu can disable the button. Idempotent — a daily already
 * recorded for its date is never appended twice.
 */
function recordDaily(): void {
  if (appendDailyRun(profile, state)) saveProfile(profile);
}

// --- Run save (docs/RUN-SAVE.md) ----------------------------------------------------------------

/** The last observed values the save tracker diffs each frame to spot immediate-write events. */
let prevSaveWave = state.wave;
let prevSaveClearedWaves = state.clearedWaves;
let prevSavePhase = state.phase;
let prevSavePaused = state.paused;
let prevTowersBuilt = state.towersBuilt;
let prevUpgradesBought = state.upgradesBought;
let prevBranches = state.branches;
let prevTowersSold = state.towersSold;

/** Re-baseline the tracker after the run object is replaced, so a swap is not read as a wave jump. */
function resetSaveTrackers(): void {
  prevSaveWave = state.wave;
  prevSaveClearedWaves = state.clearedWaves;
  prevSavePhase = state.phase;
  prevSavePaused = state.paused;
  prevTowersBuilt = state.towersBuilt;
  prevUpgradesBought = state.upgradesBought;
  prevBranches = state.branches;
  prevTowersSold = state.towersSold;
}

/** The menu's Continue label: the saved wave and map (docs/RUN-SAVE.md). */
function continueLabel(s: RunState): string {
  return `Wave ${s.wave} — ${s.level.name}`;
}

/**
 * Write the run save, guarded by `?nosave`, a Test run, and the not-yet-started wave. A forced write
 * is the immediate one (wave start/clear, a build action, pause, Esc, pagehide); otherwise the write
 * is throttled to one per two seconds of run time.
 */
function maybeSaveRun(force = false): void {
  if (nosave || runOrigin === 'editor' || state.daily !== null || state.wave < 1) return;
  if (state.phase === 'halted' || state.phase === 'victory') return;
  if (!force && state.clock - lastRunSaveClock < SAVE_INTERVAL_TICKS) return;
  saveRun(state);
  lastRunSaveClock = state.clock;
}

/**
 * Called once per run frame after stepping: immediate writes on wave start, wave clear, a build
 * action and pause, the throttled background write otherwise, and the key clear on end-of-run.
 */
function syncRunSave(): void {
  if (state.wave > prevSaveWave) maybeSaveRun(true);
  else if (state.clearedWaves > prevSaveClearedWaves) maybeSaveRun(true);
  else if (state.paused !== prevSavePaused) maybeSaveRun(true);
  else if (
    state.towersBuilt !== prevTowersBuilt ||
    state.upgradesBought !== prevUpgradesBought ||
    state.branches !== prevBranches ||
    state.towersSold !== prevTowersSold
  ) maybeSaveRun(true);
  else maybeSaveRun(false);

  if (state.phase !== prevSavePhase) {
    if (state.phase === 'victory' || state.phase === 'halted') {
      if (state.daily !== null) {
        // A daily records one attempt and never touches the normal run save.
        recordDaily();
      } else {
        recordRun(state.phase === 'victory' ? 'victory' : 'defeat');
        clearRunSave();
      }
    }
  }

  prevSaveWave = state.wave;
  prevSaveClearedWaves = state.clearedWaves;
  prevSavePhase = state.phase;
  prevSavePaused = state.paused;
  prevTowersBuilt = state.towersBuilt;
  prevUpgradesBought = state.upgradesBought;
  prevBranches = state.branches;
  prevTowersSold = state.towersSold;
}

function doRestartWindows(): void {
  const { profile: next } = restartWindows(state, profile);
  // A reboot that ends a still-running (not yet victorious or defeated) run records it; the victory
  // and defeat cases are already recorded on the phase transition.
  if (!state.cheatsUsed && state.phase !== 'victory' && state.phase !== 'halted') {
    appendRun(next, buildRunRecord(state, 'reboot'));
  }
  const newly = next.achievements.filter((id) => !profile.achievements.includes(id));
  profile = next;
  const profileNewly = checkProfileAchievements(profile);
  saveProfile(profile);
  clearRunSave();
  state = createRunState(profile);
  resetRunNotified();
  resetSaveTrackers();
  syncViewport();
  dialog = null;
  menu = null;
  closeRunModals();
  for (const id of newly) toastAchievement(id);
  for (const id of profileNewly) toastAchievement(id);
  stampEarnedDates([...newly, ...profileNewly]);
}

function doNewRun(): void {
  state = createRunState(profile);
  resetRunNotified();
  resetSaveTrackers();
  syncViewport();
  dialog = null;
  menu = null;
  closeRunModals();
}

function openMenu(name: MenuName | null): void {
  menu = name ? buildMenu(name) : null;
}

function buildMenu(name: MenuName): OpenMenu {
  if (name === 'view') {
    return {
      name,
      entries: [
        { id: 'records', label: 'Records' },
        { id: 'separator', label: '', separator: true },
        { id: 'shake', label: profile.shakeOn ? 'Screen shake: On' : 'Screen shake: Off' },
      ],
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
        rows: [{ text: `This closes the run and banks ${restartPointsGained(state, profile)} Restore Points.` }],
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
    case 'achievements':
      achievementSession.show();
      break;
    case 'about':
      dialog = {
        title: 'About',
        rows: [{ text: `${pkg.name} v${pkg.version}` }, { text: pkg.description }],
        buttons: [{ id: 'close', label: 'Close' }],
      };
      break;
    case 'show-help':
      helpSession.show(layout);
      // shadow-help-clippy: open the Help window while a boss is on the board.
      if (state.phase === 'wave' && state.enemies.some((e) => e.isBoss && !e.dead)) {
        notifyAchievement(state, 'shadow-help-clippy');
      }
      break;
    case 'records':
      recordsSession.show();
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
  if (id === 'editor-new') {
    doEditorNew();
    return;
  }
  if (id === 'cancel' || id === 'close') {
    dialog = null;
  }
}

function closeDialog(): void {
  dialog = null;
}

// --- Achievements grid -------------------------------------------------------------------------

function achievementModel(): AchievementGridModel {
  const model = buildAchievementGrid(profile.achievements, profile.achievementDates, achievementSession.filter);
  model.selectedId = achievementSession.selectedId;
  model.scroll = achievementSession.scroll;
  return model;
}

function achievementHit(x: number, y: number) {
  const model = achievementModel();
  const al = computeAchievementGrid(model, layout.client);
  return { model, al, hit: achievementGridHitAt(al, model, x, y) };
}

function achievementPointerDown(x: number, y: number, button: number): boolean {
  if (button !== 0) return pointInRect(computeAchievementGrid(achievementModel(), layout.client).window, x, y);
  const { hit } = achievementHit(x, y);
  if (hit === null) return false;
  if (hit.type === 'close') {
    achievementSession.hide();
  } else if (hit.type === 'filter') {
    achievementSession.setFilter(hit.filter);
  } else if (hit.type === 'cell') {
    achievementSession.clickCell(hit.id);
  }
  return true;
}

function achievementPointerMove(x: number, y: number): void {
  const { hit } = achievementHit(x, y);
  const hoveredId = hit?.type === 'cell' ? hit.id : null;
  if (hoveredId !== achievementSession.hoveredId) achievementSession.hoveredId = hoveredId;
}

function achievementMove(dx: number, dy: number): void {
  const model = achievementModel();
  const al = computeAchievementGrid(model, layout.client);
  achievementSession.moveSelection(dx, dy, model.entries, al);
}

// --- Screen transitions -----------------------------------------------------------------------

function startRun(level: Level, origin: 'play' | 'load' | 'editor'): void {
  state = createRunState(profile, level);
  resetRunNotified();
  resetSaveTrackers();
  if (batteryLow) notifyAchievement(state, 'shadow-flat-battery');
  syncViewport();
  runOrigin = origin;
  screen = 'run';
  menu = null;
  dialog = null;
  closeRunModals();
  loadOpen = false;
  loadInput.blur();
}

function startPlay(): void {
  profile.lastChoice = 'play';
  saveProfile(profile);
  startRun(DEFAULT_LEVEL, 'play');
}

/** The Daily button's label and disabled state, computed from the profile and the local date. */
function dailyMenu(): { label: string; disabled: boolean } {
  const today = dailyDate();
  return {
    label: dailyMenuLabel(profile.daily, today),
    disabled: !dailyAvailable(profile.daily, today),
  };
}

/** Start today's daily (docs/DAILY.md), or do nothing when it has already been played. */
function startDaily(): void {
  const date = dailyDate();
  if (!dailyAvailable(profile.daily, date)) return;
  const { seed, level } = dailyFor(date);
  state = createRunState(profile, level, { waveLimit: DAILY_WAVES, daily: { date, seed }, seed });
  resetRunNotified();
  resetSaveTrackers();
  if (batteryLow) notifyAchievement(state, 'shadow-flat-battery');
  syncViewport();
  runOrigin = 'play';
  screen = 'run';
  menu = null;
  dialog = null;
  closeRunModals();
  loadOpen = false;
  loadInput.blur();
  hud.showNotice(`Daily — ${date}`, 180);
}

/** Resume the saved run from the main menu's Continue button. */
function startContinue(): void {
  if (continueState === null) return;
  state = continueState;
  continueState = null;
  resetRunNotified();
  resetSaveTrackers();
  syncViewport();
  runOrigin = 'play';
  screen = 'run';
  menu = null;
  dialog = null;
  closeRunModals();
  loadOpen = false;
  loadInput.blur();
}

/** Play asks once before discarding a save: show the confirm with No as the default button. */
function askDiscardSave(): void {
  if (continueState === null) return;
  dialog = {
    title: 'Start over',
    rows: [{ text: `Start over? The saved run at wave ${continueState.wave} will be lost.` }],
    buttons: [
      { id: 'discard-run', label: 'Yes' },
      { id: 'cancel-discard', label: 'No' },
    ],
  };
}

/** The Play-discard confirm's buttons: Yes discards and starts fresh, No keeps the save. */
function menuDialogAction(id: string): void {
  if (id === 'discard-run') {
    clearRunSave();
    continueState = null;
    dialog = null;
    startPlay();
  } else if (id === 'cancel-discard') {
    dialog = null;
  }
}

function openEditorScreen(): void {
  profile.lastChoice = 'editor';
  saveProfile(profile);
  loadOpen = false;
  loadInput.blur();
  recordsSession.hide();
  screen = 'editor';
}

function openLoadDialog(): void {
  profile.lastChoice = 'load';
  saveProfile(profile);
  loadText = '';
  loadStatus = '';
  loadOpen = true;
  recordsSession.hide();
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
  grantAchievement('map-import');
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
  grantAchievement('map-export');
}

/** Esc from a run: a Test run returns to the editor (drawing intact), anything else to the menu. */
function exitRun(): void {
  if (state.daily !== null) recordDaily(); // abandoning a daily still records it (docs/DAILY.md)
  maybeSaveRun(true);
  if (runOrigin === 'editor') {
    screen = 'editor';
  } else {
    screen = 'menu';
    // The menu's Continue button reflects the save just written (or the absence of one).
    continueState = nosave ? null : loadRunSave(profile);
  }
  menu = null;
  dialog = null;
  closeRunModals();
  cancelSelection(state);
}

/** No run-scoped window survives a run boundary: Restore, Global Upgrades and achievements close. */
function closeRunModals(): void {
  restoreOpen = false;
  upgradesSession.hide();
  achievementSession.hide();
  recordsSession.hide();
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

// --- Editor draft persistence (docs/EDITOR-LIBRARY.md) ----------------------------------------

/** Trailing debounce: at most one draft write a second, whatever the edit rate. */
let draftTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDraftSave(force = false): void {
  if (force) {
    if (draftTimer !== null) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    saveEditorDraft(editor);
    return;
  }
  if (draftTimer !== null) return;
  draftTimer = setTimeout(() => {
    draftTimer = null;
    saveEditorDraft(editor);
  }, 1000);
}

// --- Editor library dialog ---------------------------------------------------------------------

let libOpen = false;
let libMode: MapLibraryMode = 'open';
let libSelectedId: string | null = null;
let libScroll = 0;
let libHover: MapLibraryHit = null;

let saveNameOpen = false;
let saveNameText = '';
let nameHover: 'ok' | 'cancel' | null = null;

function openLibrary(): void {
  libMode = 'open';
  libSelectedId = null;
  libScroll = 0;
  libOpen = true;
}

function closeLibrary(): void {
  libOpen = false;
  libSelectedId = null;
}

function loadSelectedMap(): void {
  if (libSelectedId === null) return;
  const entry = editorLib.find((m) => m.id === libSelectedId);
  if (!entry) return;
  applyMapEntry(editor, entry);
  scheduleDraftSave(true);
  closeLibrary();
  showEditorNotice(`Loaded "${entry.name}"`);
}

function deleteSelectedMap(): void {
  if (libSelectedId === null) return;
  editorLib = deleteLibraryMap(editorLib, libSelectedId);
  saveLibrary(editorLib);
  libSelectedId = null;
}

function doEditorSave(name: string): void {
  if (!editorPlayable(editor)) return;
  const savedAt = new Date().toISOString();
  const level = editorLevel(editor);
  const result =
    editor.libraryId !== null
      ? saveLibraryMap(editorLib, editor.libraryId, name, level, savedAt)
      : saveLibraryMap(editorLib, null, name, level, savedAt);
  editorLib = result.maps;
  editor.libraryId = result.entry.id;
  editor.name = result.entry.name;
  saveLibrary(editorLib);
  scheduleDraftSave(true);
  showEditorNotice(`Saved "${result.entry.name}"`);
}

function editorSave(): void {
  if (!editorPlayable(editor)) {
    showEditorNotice(`Cannot save: ${editorValidation(editor)}`);
    return;
  }
  if (editor.libraryId === null && editor.name === '') {
    saveNameOpen = true;
    saveNameText = editor.name;
    nameInput.value = editor.name;
    nameInput.focus();
    nameInput.select();
    return;
  }
  if (editor.libraryId === null && editorLib.length >= LIBRARY_MAX) {
    libMode = 'replace';
    libSelectedId = null;
    libScroll = 0;
    libOpen = true;
    return;
  }
  doEditorSave(editor.name);
}

function confirmSaveName(): void {
  const name = sanitizeMapName(saveNameText);
  saveNameOpen = false;
  nameInput.blur();
  editor.name = name;
  editorSave();
}

function replaceSelectedMap(): void {
  if (libSelectedId === null) return;
  const name = editor.name === '' ? 'Untitled' : editor.name;
  const savedAt = new Date().toISOString();
  const result = replaceLibraryMap(editorLib, libSelectedId, name, editorLevel(editor), savedAt);
  editorLib = result.maps;
  editor.libraryId = result.entry.id;
  editor.name = result.entry.name;
  saveLibrary(editorLib);
  scheduleDraftSave(true);
  closeLibrary();
  showEditorNotice(`Saved "${result.entry.name}"`);
}

function editorNew(): void {
  if (!editorIsEmpty(editor)) {
    dialog = {
      title: 'New map',
      rows: [{ text: 'Discard the current drawing and start a new map?' }],
      buttons: [
        { id: 'editor-new', label: 'OK' },
        { id: 'cancel', label: 'Cancel' },
      ],
    };
    return;
  }
  doEditorNew();
}

function doEditorNew(): void {
  clearEditor(editor);
  editor.name = '';
  editor.libraryId = null;
  scheduleDraftSave(true);
  showEditorNotice('New map');
}

const mouse = new MouseController(app, {
  layout: () => layout,
  state: () => state,
  menu: () => menu,
  dialog: () => dialog,
  screen: () => screen,
  restart: () => {
    state = createRunState(profile);
    resetRunNotified();
    syncViewport();
    closeRunModals();
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
  helpPointerUp: () => {
    // shadow-drag: drag the Help window to the clamped edge and release.
    if (helpSession.draggedToEdge) {
      notifyAchievement(state, 'shadow-drag');
      helpSession.draggedToEdge = false;
    }
    helpSession.endDrag();
  },
  helpScrollBy: (dy: number) => {
    const hl = computeHelpLayout(helpSession.x, helpSession.y);
    helpSession.scrollBy(dy, hl);
  },
  helpPage: (dir: number) => {
    const hl = computeHelpLayout(helpSession.x, helpSession.y);
    helpSession.scrollPage(dir, hl);
  },
  closeHelp: () => helpSession.hide(),
  recordsOpen: () => recordsSession.open,
  recordsPointerDown: (x: number, y: number, button: number): boolean => {
    const rl = computeRecordsLayout(layout, profile.runs, recordsSession.scroll);
    const hit = recordsHitAt(rl, x, y);
    if (hit === null) return false;
    if (button !== 0) return true;
    if (hit === 'close') recordsSession.hide();
    return true;
  },
  closeRecords: () => recordsSession.hide(),
  achievementOpen: () => achievementSession.open,
  achievementPointerDown,
  achievementPointerMove,
  achievementMove,
  closeAchievement: () => achievementSession.hide(),
  restoreOpen: () => restoreOpen,
  openRestore: () => {
    upgradesSession.hide();
    restoreOpen = true;
  },
  closeRestore: () => {
    restoreOpen = false;
  },
  upgradesOpen: () => upgradesSession.open,
  openUpgrades,
  closeUpgrades: () => upgradesSession.hide(),
  upgradesPointerDown: (x: number, y: number, button: number): boolean => {
    const ul = computeUpgradesLayout(layout, state);
    const hit = upgradesHitAt(ul, x, y);
    if (hit === null) return false;
    if (button !== 0) return true;
    if (hit.type === 'close') upgradesSession.hide();
    else if (hit.type === 'buy') buyGlobalUpgrade(hit.id);
    if (hit.type === 'buy' || hit.type === 'row') {
      const index = ul.rows.findIndex((r) => r.def.id === hit.id);
      if (index >= 0) upgradesSession.selected = index;
    }
    return true;
  },
  upgradesKey: (key) => {
    const rows = computeUpgradesLayout(layout, state).rows;
    if (key === 'up') upgradesSession.move(-1, rows.length);
    else if (key === 'down') upgradesSession.move(1, rows.length);
    else {
      const row = rows[upgradesSession.selected];
      if (row && upgradeRowBuyable(row)) buyGlobalUpgrade(row.def.id);
    }
  },
  restorePointerDown: (x: number, y: number, button: number): boolean => {
    const rl = computeRestoreLayout(layout, profile);
    if (!pointInRect(rl.window, x, y)) return false;
    if (button !== 0) return true;
    const hit = restoreHitAt(rl, x, y);
    if (hit === null) return true;
    if (hit.type === 'close') restoreOpen = false;
    else if (hit.type === 'node') buyTreeNode(hit.id);
    else if (hit.type === 'spec') {
      if (buySpec(state, hit.kind)) {
        syncProfileMeta();
        saveProfile(profile);
      }
    }
    return true;
  },
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
      scheduleDraftSave();
      break;
    case 'redo':
      redoEditor(editor);
      scheduleDraftSave();
      break;
    case 'new':
      editorNew();
      break;
    case 'open':
      openLibrary();
      break;
    case 'save':
      editorSave();
      break;
    case 'clear':
      clearEditor(editor);
      scheduleDraftSave(true);
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
  scheduleDraftSave();
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

// The save-name text field: an invisible HTML input overlaid on the name dialog's field, so typing
// works natively while the look stays in the canvas. The dialog itself draws the text.
const nameInput = document.createElement('input');
nameInput.type = 'text';
nameInput.autocomplete = 'off';
nameInput.spellcheck = false;
nameInput.maxLength = 24;
nameInput.style.position = 'fixed';
nameInput.style.border = 'none';
nameInput.style.background = 'transparent';
nameInput.style.color = 'transparent';
nameInput.style.caretColor = '#000000';
nameInput.style.outline = 'none';
nameInput.style.padding = '0 4px';
nameInput.style.boxSizing = 'border-box';
nameInput.style.font = '13px Tahoma, Verdana, Geneva, sans-serif';
nameInput.style.display = 'none';
nameInput.style.zIndex = '10';
document.body.appendChild(nameInput);
nameInput.addEventListener('input', () => {
  saveNameText = nameInput.value;
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmSaveName();
  else if (e.key === 'Escape') {
    saveNameOpen = false;
    nameInput.blur();
  }
});

app.canvas.addEventListener('pointermove', (e) => {
  const { x, y } = canvasPoint(e);
  if (screen === 'menu') {
    menuHover = loadOpen ? null : menuButtonAt(layout, x, y, continueState !== null ? continueLabel(continueState) : null, dailyMenu());
    loadHover = loadOpen ? loadDialogButtonAt(layout, x, y) : null;
    return;
  }
  if (screen === 'editor') {
    if (libOpen) {
      libHover = mapLibraryHitAt(layout, editorLib, libMode, x, y, libScroll);
    } else if (saveNameOpen) {
      nameHover = nameDialogButtonAt(layout, x, y);
    }
    const modalOpen = libOpen || saveNameOpen || dialog !== null;
    editorActionHover = modalOpen ? null : editorToolbarAt(layout, editor, x, y);
    if (!modalOpen) {
      const hit = boardHit(x, y);
      if (painting && hit.onBoard) {
        const refusal = paintEditor(editor, hit.col, hit.row);
        if (refusal) showEditorNotice(refusal);
        else scheduleDraftSave();
      }
    }
    return;
  }
});

app.canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  if (screen === 'menu') {
    // The Records viewer, when open on the menu, owns clicks inside it (its close box, or the window
    // swallowing a stray click); a click outside falls through to the menu buttons.
    if (recordsSession.open) {
      const rl = computeRecordsLayout(layout, profile.runs, recordsSession.scroll);
      const hit = recordsHitAt(rl, x, y);
      if (hit === 'close') {
        recordsSession.hide();
        return;
      }
      if (hit === 'window') return;
    }
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
    // The Play-discard confirm is a modal over the menu; it owns every click while it is open.
    if (dialog) {
      const id = dialogButtonAt(layout, dialog, x, y);
      if (id) menuDialogAction(id);
      return;
    }
    const label = continueState !== null ? continueLabel(continueState) : null;
    const btn = menuButtonAt(layout, x, y, label, dailyMenu());
    if (btn === 'continue') startContinue();
    else if (btn === 'play') {
      if (continueState !== null) askDiscardSave();
      else startPlay();
    } else if (btn === 'daily') startDaily();
    else if (btn === 'editor') openEditorScreen();
    else if (btn === 'load') openLoadDialog();
    else if (btn === 'records') recordsSession.show();
    return;
  }
  if (screen === 'editor') {
    if (libOpen) {
      if (e.button !== 0) return;
      const hit = mapLibraryHitAt(layout, editorLib, libMode, x, y, libScroll);
      if (hit?.type === 'row') libSelectedId = hit.id;
      else if (hit?.type === 'load') {
        if (libMode === 'replace') replaceSelectedMap();
        else loadSelectedMap();
      } else if (hit?.type === 'delete') deleteSelectedMap();
      else if (hit?.type === 'cancel') closeLibrary();
      return;
    }
    if (saveNameOpen) {
      if (e.button !== 0) return;
      const btn = nameDialogButtonAt(layout, x, y);
      if (btn === 'ok') confirmSaveName();
      else if (btn === 'cancel') {
        saveNameOpen = false;
        nameInput.blur();
      }
      return;
    }
    if (dialog) {
      if (e.button !== 0) return;
      const id = dialogButtonAt(layout, dialog, x, y);
      if (id) dialogAction(id);
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      const hit = boardHit(x, y);
      if (hit.onBoard) {
        eraseEditor(editor, hit.col, hit.row);
        scheduleDraftSave();
      }
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
      else {
        scheduleDraftSave();
        grantAchievement('editor-first');
      }
    }
    return;
  }
});

app.canvas.addEventListener('pointerup', (e) => {
  if (e.button === 0) painting = false;
});

app.canvas.addEventListener('wheel', (e) => {
  const { x, y } = canvasPoint(e as unknown as PointerEvent);
  // The Help window scrolls its page three lines per notch while the pointer is over the page panel.
  if (helpSession.open) {
    const hl = computeHelpLayout(helpSession.x, helpSession.y);
    if (pointInRect(hl.pagePanel, x, y)) {
      e.preventDefault();
      helpSession.scrollBy(Math.sign(e.deltaY) * HELP_LINE_H * HELP_SCROLL_LINES, hl);
      return;
    }
  }
  if (screen === 'editor' && libOpen) {
    const ml = computeMapLibrary(layout, editorLib, libMode, libScroll);
    if (pointInRect(ml.list, x, y)) {
      e.preventDefault();
      libScroll = Math.min(Math.max(0, libScroll + Math.sign(e.deltaY) * 26), ml.maxScroll);
      return;
    }
  }
  // The Records viewer scrolls its table three rows per notch while the pointer is over the data panel.
  if (recordsSession.open) {
    const rl = computeRecordsLayout(layout, profile.runs, recordsSession.scroll);
    if (pointInRect(rl.data, x, y)) {
      e.preventDefault();
      recordsSession.scrollBy(Math.sign(e.deltaY) * RECORDS_ROW_H * 3, rl);
      return;
    }
  }
  if (!achievementSession.open) return;
  const { al } = achievementHit(x, y);
  if (!pointInRect(al.window, x, y)) return;
  e.preventDefault();
  achievementSession.scrollBy(e.deltaY, al);
}, { passive: false });

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (typingTarget(e.target)) return;
  if (screen === 'menu') {
    if (recordsSession.open && e.key === 'Escape') {
      recordsSession.hide();
      return;
    }
    if (loadOpen) {
      if (e.key === 'Escape') {
        loadOpen = false;
        loadText = '';
        loadStatus = '';
      }
      return;
    }
    // The Play-discard confirm: Enter (the default) keeps the save, Esc closes, Y discards.
    if (dialog) {
      if (e.key === 'Enter' || e.key === 'Escape') dialog = null;
      else if (e.key === 'y' || e.key === 'Y') menuDialogAction('discard-run');
      return;
    }
    if (e.key === 'Enter') {
      if (continueState !== null) startContinue();
      else startPlay();
    } else if (e.key === 'p' || e.key === 'P') {
      if (continueState !== null) askDiscardSave();
      else startPlay();
    } else if (e.key === 'e' || e.key === 'E') openEditorScreen();
    else if (e.key === 'l' || e.key === 'L') openLoadDialog();
    else if (e.key === 'd' || e.key === 'D') startDaily();
    return;
  }
  if (screen === 'editor') {
    if (e.key === 'Escape') {
      if (libOpen) closeLibrary();
      else if (saveNameOpen) {
        saveNameOpen = false;
        nameInput.blur();
      } else if (dialog) dialog = null;
      else {
        scheduleDraftSave(true);
        screen = 'menu';
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey) redoEditor(editor);
      else undoEditor(editor);
      scheduleDraftSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      redoEditor(editor);
      scheduleDraftSave();
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
      case 'traySpawned':
        sfx.play('ad');
        break;
      case 'trayClaimed':
        sfx.play('adClose');
        hud.showNotice(BUFF_LINES[ev.kind]);
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
    syncRunSave();
    // Persist cross-run counters the sim just advanced (maps cleared, lifetime boss kills).
    if (state.profileDirty) {
      state.profileDirty = false;
      saveProfile(profile);
    }
    // shadow-reload: a reload after a prior run, then the first wave of the new session clears.
    if (reloadedAfterRun && state.clearedWaves >= 1) {
      notifyAchievement(state, 'shadow-reload');
      reloadedAfterRun = false;
    }
    // shadow-hover: a tooltip stays open for 60 cumulative seconds.
    if (tooltip.showing) {
      tooltipHoverMs += ticker.deltaMS;
      if (tooltipHoverMs >= 60_000) {
        notifyAchievement(state, 'shadow-hover');
        tooltipHoverMs = 0;
      }
    } else {
      tooltipHoverMs = 0;
    }
    // shadow-clippy: every currently-unlocked Help page visited before any wave clears.
    if (state.wave === 0 && helpSession.visitedCount(profile) >= HELP_PAGES.filter((p) => pageUnlocked(p, profile)).length) {
      notifyAchievement(state, 'shadow-clippy');
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
    trayView.draw(state);
    helpView.draw(helpSession, profile, mouse.hover.x, mouse.hover.y);
    restoreView.draw(restoreOpen, profile, layout);
    // The run ending (or a new run starting) takes the dialog down with it.
    if (upgradesSession.open && (state.phase === 'halted' || state.phase === 'victory' || upgradesState !== state)) {
      upgradesSession.hide();
    }
    // The Records viewer is for a live run; once the run ends, it steps aside for the end-of-run modal.
    if (recordsSession.open && (state.phase === 'halted' || state.phase === 'victory')) {
      recordsSession.hide();
    }
    upgradesState = state;
    upgradesView.draw(upgradesSession.open, state, layout, upgradesSession.selected);
    if (achievementSession.open) {
      const m = achievementModel();
      const al = computeAchievementGrid(m, layout.client);
      const hit = achievementGridHitAt(al, m, mouse.hover.x, mouse.hover.y);
      m.hoveredId = hit?.type === 'cell' ? hit.id : null;
      achievementView.draw(m, layout);
    } else {
      achievementView.draw(null, layout);
    }
    dialogView.draw(dialog, layout);
    updateTooltip();
    const shakeOffset = shake.offset(state.tick);
    root.position.set(shakeOffset.x, shakeOffset.y);
  } else {
    root.position.set(0, 0);
  }

  chrome.draw(layout, running ? mouse.hover.menuItem : -1);
  menuView.draw(layout.menu, running ? menu : null, running ? mouse.hover.menuHover : null);
  recordsView.draw(recordsSession, profile, layout);

  // Per-screen content; run-only views are hidden on the menu and in the editor.
  board.root.visible = running;
  effects.root.visible = running;
  numbers.root.visible = running;
  bossBars.root.visible = running;
  hud.root.visible = running;
  helpView.root.visible = running && helpSession.open;
  recordsView.root.visible = recordsSession.open;
  restoreView.root.visible = running && restoreOpen;
  upgradesView.root.visible = running && upgradesSession.open;
  achievementView.root.visible = running && achievementSession.open;
  ad.root.visible = running;
  menuView.root.visible = running;
  dialogView.root.visible = running || screen === 'menu' || screen === 'editor';
  tooltip.root.visible = running;
  menuScreenView.root.visible = screen === 'menu';
  loadDialogView.root.visible = screen === 'menu' && loadOpen;
  editorView.root.visible = screen === 'editor';
  mapLibraryView.root.visible = screen === 'editor' && libOpen;
  nameDialogView.root.visible = screen === 'editor' && saveNameOpen;

  if (screen === 'menu') {
    const label = continueState !== null ? continueLabel(continueState) : null;
    menuScreenView.draw(layout, menuHover, label, dailyMenu());
    dialogView.draw(dialog, layout);
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
    editorView.draw(layout, editor, { tool: null, action: libOpen || saveNameOpen || dialog !== null ? null : editorActionHover }, editorNotice);
    loadInput.style.display = 'none';
    if (libOpen) {
      mapLibraryView.draw(layout, editorLib, libMode, libSelectedId, libHover, libScroll);
    }
    if (saveNameOpen) {
      nameDialogView.draw(layout, saveNameText, nameHover);
      const d = computeNameDialog(layout);
      nameInput.style.display = 'block';
      nameInput.style.left = `${d.field.x}px`;
      nameInput.style.top = `${d.field.y}px`;
      nameInput.style.width = `${d.field.w}px`;
      nameInput.style.height = `${d.field.h}px`;
    } else {
      nameInput.style.display = 'none';
    }
    if (dialog) dialogView.draw(dialog, layout);
  }

  cursor.position.set(mouse.hover.x, mouse.hover.y);
});

/** True when the pointer is over the help window, which sits above the board and HUD. */
function overHelpWindow(x: number, y: number): boolean {
  if (!helpSession.open) return false;
  const hl = computeHelpLayout(helpSession.x, helpSession.y);
  return pointInRect(hl.window, x, y);
}

/** True when the pointer is over the Records viewer, so a tooltip never shows through it. */
function overRecordsWindow(x: number, y: number): boolean {
  if (!recordsSession.open) return false;
  const rl = computeRecordsLayout(layout, profile.runs, recordsSession.scroll);
  return pointInRect(rl.window, x, y);
}

/** The tooltip lines for a HUD spend control, computed from the same functions the click applies. */
function hudTooltipLines(action: HudAction, s: RunState): TooltipLine[] {
  const tower = selectedTower(s);
  switch (action) {
    case 'pointer':
      return pointerTooltipLines(s.pointer, s.economy.salvage, s.wave, overclockCap(s));
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
      return tower ? sellTooltipLines(tower, s.treeEffects.sellRefund) : [];
    case 'repairTower':
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      return tower ? repairTooltipLines(tower, s.clock, s.economy.salvage, s.treeEffects.repairSpeedMult) : [];
    case 'target': {
      if (noBuildActive(s)) return [NO_BUILD_MESSAGE];
      if (!tower) return [];
      const reason = targetLockReason(tower.kind);
      return reason === null ? [] : [reason];
    }
    case 'restore':
      return ['Open the Restore tree and spec shop.'];
    case 'upgrades':
      return ['Open Global Upgrades: one-shot purchases for this run, paid in salvage.'];
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
    achievementSession.open || // achievements grid open
    h.menuItem >= 0 || // over the menu bar
    state.phase === 'halted' ||
    state.phase === 'victory' ||
    (state.ad !== null && pointInRect(state.ad, h.x, h.y)) || // over an ad
    overHelpWindow(h.x, h.y) || // over the help viewer
    overRecordsWindow(h.x, h.y); // over the Records viewer

  const viewportW = app.screen.width;
  const viewportH = app.screen.height;

  // Over the Global Upgrades window: a row's detail (and its shortfall), or nothing at all, so the
  // board and HUD tooltips never show through the dialog.
  if (!suppressed && upgradesSession.open) {
    const hit = upgradesHitAt(computeUpgradesLayout(layout, state), h.x, h.y);
    if (hit !== null) {
      const def = hit.type === 'buy' || hit.type === 'row' ? GLOBAL_UPGRADES.find((d) => d.id === hit.id) : undefined;
      if (def) {
        tooltip.update({ key: `upgrade:${def.id}`, lines: globalUpgradeTooltipLines(def, state) }, h.x, h.y, viewportW, viewportH);
      } else {
        tooltip.update({ key: null, lines: [] }, h.x, h.y, viewportW, viewportH);
      }
      return;
    }
  }

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
      tooltipTowerKinds.add(tower.kind);
      if (tooltipTowerKinds.size >= TOWER_KINDS.length) notifyAchievement(state, 'shadow-tooltip');
      const healed = tower.kind === 'repair' ? repairHealingCount(state.towers, tower, state.clock) : 0;
      const maintenance = tower.kind === 'cursor' ? cursorMaintenanceStatus(state, tower) : null;
      tooltip.update(
        { key: `tower:${tower.id}`, lines: towerTooltipLines(tower, state.clock, state.pointer, pointerDamageMult(state), healed, maintenance) },
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
  // shadow-resize: play in an 800×600 window.
  if (screen === 'run' && Math.abs(app.screen.width - 800) <= 1 && Math.abs(app.screen.height - 600) <= 1) {
    notifyAchievement(state, 'shadow-resize');
  }
});

// A closing or backgrounded tab writes immediately (docs/RUN-SAVE.md), so the run and the editor
// draft survive.
window.addEventListener('pagehide', () => {
  maybeSaveRun(true);
  scheduleDraftSave(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    maybeSaveRun(true);
    scheduleDraftSave(true);
  }
});
