import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import {
  buySpec,
  createRunState,
  cursorMaintenanceStatus,
  enemyAt,
  enterEndless,
  noBuildActive,
  NO_BUILD_MESSAGE,
  restartWindows,
  selectedTower,
  step,
  toggleAutoWave,
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
import { MouseController } from './input/mouse.ts';
import { EffectsView } from './view/effects.ts';
import { BossBarView } from './view/bossBars.ts';
import { sfx, type SoundName } from './audio/sfx.ts';
import { CameraShake, shakeImpulseFor } from './view/shake.ts';
import { backingStorePixelSize, cssViewportSize, liveDevicePixelRatio } from './view/screen.ts';
import { onArtInvalidate, preloadArt, setArtDpr } from './view/art.ts';
import { repairHealingCount, TOWER_STATS, type Branch, type TowerKind } from './core/towers.ts';
import { isBossVariant } from './core/enemies.ts';
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

// Art loads without blocking the first frame; when it (or a DPR change) invalidates, the board drops
// its cached procedural art and re-reads the texture lookup on the next frame.
onArtInvalidate(() => board.invalidateArt());
void preloadArt();

const root = new Container();
app.stage.addChild(root);
root.addChild(chrome.root, board.root, effects.root, numbers.root, bossBars.root, hud.root, ad.root, menuView.root, dialogView.root, tooltip.root);

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

function openMenu(name: 'file' | 'view' | 'help' | null): void {
  menu = name ? buildMenu(name) : null;
}

function buildMenu(name: 'file' | 'view' | 'help'): OpenMenu {
  if (name === 'view') {
    return {
      name,
      entries: [{ id: 'shake', label: profile.shakeOn ? 'Screen shake: On' : 'Screen shake: Off' }],
    };
  }
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
    case 'shake':
      profile.shakeOn = !profile.shakeOn;
      shake.setEnabled(profile.shakeOn);
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
  toggleAutoWave: () => {
    toggleAutoWave(state);
    profile.autoWave = state.autoWave;
    saveProfile(profile);
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
        // A shielded or boss enemy shows a shield arc instead of a hit spark.
        const target = state.enemies.find((e) => e.id === ev.id);
        if (target && (target.kind === 'shielded' || target.kind === 'boss')) {
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
      case 'towerUnlocked':
        hud.showNotice(ev.kinds.map((k) => `${TOWER_STATS[k].name} unlocked`).join(', '));
        break;
      case 'click':
        break;
    }
  }
  if (shakeAmplitude > 0) shake.impulse(shakeAmplitude, state.tick, shakeFreezeMs);
  state.events = [];
}

app.ticker.add((ticker) => {
  const alpha = step(state, ticker.deltaMS);
  drainEvents();
  syncAchievements();
  syncBestWave();
  chrome.draw(layout, mouse.hover.menuItem);
  menuView.draw(layout.menu, menu, mouse.hover.menuHover);
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
  dialogView.draw(dialog, layout);
  updateTooltip();
  cursor.position.set(mouse.hover.x, mouse.hover.y);
  const shakeOffset = shake.offset(state.tick);
  root.position.set(shakeOffset.x, shakeOffset.y);
});

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
    case 'repair':
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
    (state.ad !== null && pointInRect(state.ad, h.x, h.y)); // over an ad

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
});
