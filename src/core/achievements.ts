/**
 * The achievement catalog, the unlock rules, and the shared stats type.
 *
 * This file is pure data plus pure predicates. The id is the key: it names the save entry and the
 * art file, so it never changes. The catalog is generated from docs/ACHIEVEMENTS.md — the id, name
 * and description are copied verbatim; `when` reads the flat `AchievementStats` snapshot that
 * `state.ts` builds once per tick (plus the `Profile` for a few meta achievements). An achievement
 * whose condition cannot be observed cheaply keeps `when: () => false` and is listed as deferred in
 * the commit message rather than guessed.
 */

import type { Profile } from './save.ts';

/**
 * One flat snapshot of every counter an unlock rule reads, rebuilt once per tick by
 * `buildStats` in state.ts. Predicates must only read this (and the profile) — never the live
 * state — so a new achievement is a single data row, not a new branch in the sim.
 */
export interface AchievementStats {
  wave: number;
  kills: number;
  killsByTower: number;
  killsByPointer: number;
  pointerHits: number;
  critHits: number;
  weakHits: number;
  weakKills: number;
  leaks: number;
  integrity: number;
  salvage: number;
  salvagePeak: number;
  earned: number;
  towersBuilt: number;
  towersSold: number;
  upgradesBought: number;
  branches: number;
  maxTowerTier: number;
  perfectWaves: number;
  perfectWaveStreak: number;
  bossesKilled: number;
  bossKillsByPointer: number;
  shieldsBroken: number;
  adsClosed: number;
  adsExpired: number;
  minesTriggered: number;
  repairsDone: number;
  salvageSpentOnRepairs: number;
  toggles: number;
  wallsBuilt: number;
  flyersKilled: number;
  aaKills: number;
  cursorKills: number;
  cursorRepairs: number;
  earlyCalls: number;
  earlyCallStreak: number;
  endlessWave: number;
  wavesAtThreeSpeed: number;
  cheatsUsed: boolean;
  treesFullyUpgraded: boolean;
  treeNodeCount: number;
  prestigeLevel: number;
  rebootCount: number;
  mapId: string;
  customMap: boolean;
  timeOfDayHour: number;
  pausedTicks: number;

  // Additional cheap counters the existing catalog and a few new rules need; not every predicate
  // reads them, but buildStats fills them all once so the loop never recomputes.
  routeLength: number;
  rp: number;
  clearedWaves: number;
  startingWave: number;
  towerKinds: number;
  tierFiveCount: number;
  beaconCount: number;
  maxedBranch: boolean;
  aaFlak: boolean;
  cursorBuilt: boolean;
  bossKilledByPointer: boolean;
  milestoneBossByPointer: boolean;
  overclockMax: boolean;
  cleanWave: boolean;
  integrityLowWater: number;
  clearedWave1NoLeak: boolean;
  maxTreeTier: number;
  killedCarrier: boolean;
  killedDreadnought: boolean;
  killedWirecutter: boolean;
  killedRam: boolean;
}

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** A shadow achievement has no cell on the grid until it fires (docs/ACHIEVEMENTS.md). */
  readonly hidden?: boolean;
  readonly when?: (s: AchievementStats, p: Profile) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- Pointer and the clicker ---------------------------------------------------------------
  { id: 'first-blood', name: 'First Blood', description: 'First kill of any run', when: (s) => s.kills > 0 },
  { id: 'sharpshooter', name: 'Sharpshooter', description: '100 weak-point hits in one run', when: (s) => s.weakHits >= 100 },
  { id: 'weak-point-kills', name: 'Deadeye', description: '50 weak-point kills in one run', when: (s) => s.weakKills >= 50 },
  { id: 'crit-hits', name: 'Lucky Streak', description: '25 critical hits in one run', when: (s) => s.critHits >= 25 },
  { id: 'crit-100', name: 'Critical Mass', description: '100 critical hits in one run', when: (s) => s.critHits >= 100 },
  { id: 'pointer-1k', name: 'Thousand Clicks', description: '1,000 pointer hits in one run', when: (s) => s.pointerHits >= 1000 },
  // Deferred: 10 kills in a 10-second sliding window needs a kill-time ring buffer.
  { id: 'click-combo', name: 'Combo Breaker', description: '10 kills in 10 seconds with the pointer', when: () => false },
  // Deferred: "after overriding its targeting" needs override-state tracked per kill.
  { id: 'override', name: 'Manual Override', description: 'Kill a boss after overriding its targeting', when: () => false },
  // Deferred: "no towers built" per wave needs a per-clear flag.
  { id: 'pointer-only-wave', name: 'Bare Hands', description: 'Clear a wave with no towers built', when: () => false },
  { id: 'weak-point-10', name: 'Getting the Point', description: '10 weak-point hits in one run', when: (s) => s.weakHits >= 10 },
  { id: 'crit-first', name: "Beginner's Luck", description: 'Land a crit in the first wave', when: (s) => s.critHits >= 1 && s.wave <= 1 },
  { id: 'overclock-max', name: 'Overclocked', description: 'Buy every overclock tier in one run', when: (s) => s.overclockMax },
  // Deferred: "untouched for 60 s" needs an idle timer.
  { id: 'click-idle', name: 'Autopilot', description: 'Let the pointer run untouched for 60 s while towers kill', when: () => false },
  // Deferred: "lifetime" needs a cross-run counter the profile does not carry.
  { id: 'pointer-boss-10', name: 'Boss Hunter', description: 'Kill 10 bosses with the pointer, lifetime', when: () => false },

  // --- Towers -------------------------------------------------------------------------------
  { id: 'five-tier-five', name: 'Five Tier Fives', description: 'Five tier-5 towers at once', when: (s) => s.tierFiveCount >= 5 },
  { id: 'beacon-field', name: 'Beacon Field', description: 'Ten beacons at once', when: (s) => s.beaconCount >= 10 },
  { id: 'maxed-branch', name: 'Maxed Out', description: 'Fully upgrade a branched tower', when: (s) => s.maxedBranch },
  { id: 'aa-flak', name: 'Flak Jacket', description: 'Branch an AA tower into Flak', when: (s) => s.aaFlak },
  { id: 'mine-layer', name: 'Deminer', description: 'Trigger 25 mines in one run', when: (s) => s.minesTriggered >= 25 },
  // Deferred: "walls and no damage towers" needs the per-wave board composition at clear time.
  { id: 'wall-only-wave', name: 'Brick by Brick', description: 'Clear a wave with walls and no damage towers', when: () => false },
  { id: 'toggle-master', name: 'Gatekeeper', description: 'Toggle a shutter 50 times in one run', when: (s) => s.toggles >= 50 },
  { id: 'repair-shop', name: 'Handy', description: 'Spend 2,000 salvage on repairs in one run', when: (s) => s.salvageSpentOnRepairs >= 2000 },
  { id: 'tower-zoo', name: 'Full House', description: 'Have one of every tower kind standing at once', when: (s) => s.towerKinds >= 10 },
  { id: 'tier-five-first', name: 'First of Five', description: 'Take any tower to tier 5', when: (s) => s.maxTowerTier >= 5 },
  { id: 'sell-10', name: 'Liquidator', description: 'Sell 10 towers in one run', when: (s) => s.towersSold >= 10 },
  // Deferred: "wave 30 with no tower above tier 1" needs a per-clear tier snapshot.
  { id: 'no-upgrade-wave', name: 'Bare Bones', description: 'Clear wave 30 with no tower above tier 1', when: () => false },
  // Deferred: per-shot kill counts for a single beam.
  { id: 'laser-chain', name: 'Beam Me Up', description: 'Kill 5 enemies with one Laser beam', when: () => false },
  // Deferred: "12 enemies slowed at once" needs a slowed-enemy tally.
  { id: 'frost-lock', name: 'Deep Freeze', description: 'Keep 12 enemies slowed at once', when: () => false },
  // Deferred: per-shot chain count.
  { id: 'taser-chain', name: 'Chain Reaction', description: 'Tase 4 enemies with one shot', when: () => false },
  // Deferred: per-shell splash kill count.
  { id: 'cannon-splash', name: 'Splash Zone', description: 'Kill 6 enemies with one shell', when: () => false },
  { id: 'cursor-first', name: 'Utility Belt', description: 'Build a Cursor tower', when: (s) => s.cursorBuilt },
  // Deferred: "with one Cursor" needs per-cursor repair tally.
  { id: 'cursor-repair', name: 'Maintenance Window', description: 'Repair 5 towers with one Cursor', when: () => false },
  // Deferred: "with 3 beacons boosting it" needs a per-tower aura count.
  { id: 'beacon-buff', name: 'Force Multiplier', description: 'Have a tower deal damage with 3 beacons boosting it', when: () => false },
  { id: 'one-kind', name: 'One-Trick Pony', description: 'Clear a wave with a single tower kind on the board', when: (s) => s.clearedWaves > 0 && s.towerKinds === 1 },
  // Deferred: "wave 40 with exactly two tower kinds" needs the per-clear composition.
  { id: 'two-kinds', name: 'Double Threat', description: 'Clear wave 40 with exactly two tower kinds', when: () => false },
  { id: 'upgrade-first', name: 'Tuned', description: 'Buy any tower upgrade', when: (s) => s.upgradesBought >= 1 },
  { id: 'branch-first', name: 'Fork in the Road', description: 'Take any tower branch', when: (s) => s.branches >= 1 },
  { id: 'sell-tower-first', name: 'Change of Plan', description: 'Sell a tower for the first time', when: (s) => s.towersSold >= 1 },

  // --- Economy ------------------------------------------------------------------------------
  { id: 'salvage-peak', name: 'Deep Pockets', description: 'Hold 1,000 salvage at once', when: (s) => s.salvagePeak >= 1000 },
  { id: 'salvage-10k', name: 'Loaded', description: 'Hold 10,000 salvage at once', when: (s) => s.salvagePeak >= 10000 },
  { id: 'earn-100k', name: 'Venture Capital', description: 'Earn 100,000 salvage in one run', when: (s) => s.earned >= 100000 },
  // Deferred: "spending nothing" per wave needs a per-wave spend tally.
  { id: 'no-spend-wave', name: 'Thrift', description: 'Clear a wave spending nothing', when: () => false },
  { id: 'ad-collector', name: 'Ad Collector', description: 'Dismiss ten ads in one run', when: (s) => s.adsClosed >= 10 },
  { id: 'ad-ignore', name: 'Adblock', description: 'Let ten ads expire without closing them', when: (s) => s.adsExpired >= 10 },
  { id: 'early-call-streak', name: 'Speedrunner', description: 'Call three waves early in a row', when: (s) => s.earlyCallStreak >= 3 },
  { id: 'early-call-10', name: 'Overclocked Clock', description: 'Call 10 waves early in one run', when: (s) => s.earlyCalls >= 10 },
  // Deferred: "wave 1" cannot be called early (it is the first call from build).
  { id: 'early-call-wave-1', name: 'Jump the Gun', description: 'Call wave 1 early', when: () => false },
  // Deferred: "untouched for 5 minutes" needs an idle timer.
  { id: 'idle-hour', name: 'Background Task', description: 'Leave auto-wave running for 5 minutes untouched', when: () => false },
  // Deferred: a sale refunds 70% (90% with Hot Swap), never more than paid — the condition cannot be met.
  { id: 'sell-profit', name: 'Buy Low', description: 'Sell a tower for more than you paid for it', when: () => false },
  { id: 'no-sell', name: 'Pack Rat', description: 'Reach wave 20 without selling a tower', when: (s) => s.wave >= 20 && s.towersSold === 0 },

  // --- Waves and survival -------------------------------------------------------------------
  { id: 'clean-wave', name: 'Clean Wave', description: 'Clear a wave at 40+ with no leaks', when: (s) => s.cleanWave },
  { id: 'flawless-wave', name: 'No Leaks', description: 'Clear a wave with zero leaks', when: (s) => s.perfectWaves > 0 },
  { id: 'flawless-10', name: 'Spotless', description: 'Clear 10 waves with no leaks in one run', when: (s) => s.perfectWaves >= 10 },
  { id: 'perfect-run', name: 'Untouchable', description: 'Reach wave 50 without losing integrity', when: (s) => s.wave >= 50 && s.leaks === 0 },
  { id: 'long-road', name: 'Long Road', description: 'Route length 50 or more', when: (s) => s.routeLength >= 50 },
  { id: 'maze-100', name: 'Labyrinth', description: 'Route length 100 or more', when: (s) => s.routeLength >= 100 },
  { id: 'wave-25', name: 'Quarter Century', description: 'Reach wave 25', when: (s) => s.wave >= 25 },
  { id: 'wave-50', name: 'Halfway', description: 'Reach wave 50', when: (s) => s.wave >= 50 },
  { id: 'wave-100', name: 'Centurion', description: 'Reach wave 100', when: (s) => s.wave >= 100 },
  { id: 'endless-150', name: 'Endless', description: 'Reach endless wave 150', when: (s) => s.endlessWave >= 150 },
  { id: 'endless-200', name: 'Beyond', description: 'Reach endless wave 200', when: (s) => s.endlessWave >= 200 },
  { id: 'integrity-1', name: 'By a Thread', description: 'Survive a wave with 1 integrity left', when: (s) => s.integrity === 1 },
  { id: 'speed-3', name: 'Fast Forward', description: 'Play a wave at 3× speed', when: (s) => s.wavesAtThreeSpeed >= 1 },
  { id: 'wave-1-no-damage', name: 'Untouched', description: 'Clear wave 1 without a single leak', when: (s) => s.clearedWave1NoLeak },
  { id: 'leak-recovery', name: 'Fallen but Standing', description: 'Recover from 5 integrity back to 20 in one run', when: (s) => s.integrityLowWater <= 5 && s.integrity >= 20 },

  // --- Bosses -------------------------------------------------------------------------------
  { id: 'boss-by-pointer', name: 'Boss by Pointer', description: 'Kill a boss with the pointer alone', when: (s) => s.bossKilledByPointer },
  { id: 'milestone-boss-pointer', name: 'Milestone Hunter', description: 'Kill a milestone boss with the pointer', when: (s) => s.milestoneBossByPointer },
  { id: 'boss-10', name: 'Boss Rush', description: 'Kill 10 bosses in one run', when: (s) => s.bossesKilled >= 10 },
  { id: 'boss-first-wave', name: 'Early Grave', description: 'Kill a boss before wave 20', when: (s) => s.bossesKilled >= 1 && s.wave < 20 },
  { id: 'shield-break-5', name: 'Shield Breaker', description: 'Break 5 boss shields in one run', when: (s) => s.shieldsBroken >= 5 },
  { id: 'carrier-brood', name: 'Brood Mother', description: 'Kill a Carrier boss', when: (s) => s.killedCarrier },
  { id: 'dreadnought-kill', name: 'Ironclad', description: 'Kill a Dreadnought', when: (s) => s.killedDreadnought },
  { id: 'wirecutter-kill', name: 'Cut the Wire', description: 'Kill a Wirecutter', when: (s) => s.killedWirecutter },
  { id: 'ram-kill', name: 'Roadblock', description: 'Kill a Ram boss', when: (s) => s.killedRam },
  // Deferred: "without losing integrity" needs the boss fight's own leak accounting.
  { id: 'boss-no-leak', name: 'Boss Proof', description: 'Kill a milestone boss without losing integrity', when: () => false },

  // --- Prestige, meta and the machine -------------------------------------------------------
  // reboot-50 is awarded by restartWindows when the owned spec levels reach 50.
  { id: 'reboot-50', name: 'Reboot', description: 'Reboot with 50 or more total specs', when: () => false },
  // two-reboots, reboot-10 and all-help are awarded by checkProfileAchievements in save.ts.
  { id: 'two-reboots', name: 'Second Boot', description: 'Reboot twice', when: () => false },
  { id: 'reboot-10', name: 'Serial Reboot', description: 'Reboot 10 times', when: () => false },
  { id: 'specs-banked', name: 'Nest Egg', description: 'Start a run with banked specs', when: (s) => s.rp > 0 },
  { id: 'first-rp', name: 'Restore Point', description: 'Earn your first Restore Point', when: (s) => s.prestigeLevel > 0 },
  { id: 'rp-100', name: 'System Restore', description: 'Reach 100 lifetime Restore Points', when: (s) => s.prestigeLevel >= 100 },
  { id: 'prestige-25', name: 'Version 2.0', description: 'Reach prestige level 25', when: (s) => s.prestigeLevel >= 25 },
  { id: 'tree-tier-3', name: 'Branching Out', description: 'Buy any tier-3 tree node', when: (s) => s.maxTreeTier >= 3 },
  { id: 'tree-complete', name: 'Fully Patched', description: 'Buy every node in the Restore tree', when: (s) => s.treesFullyUpgraded },
  { id: 'fast-boot-40', name: 'Cold Boot', description: 'Start a run at wave 40', when: (s) => s.startingWave >= 40 },
  { id: 'no-cheats-100', name: 'Honest Work', description: 'Reach wave 100 with cheats never used', when: (s) => s.wave >= 100 && !s.cheatsUsed },
  { id: 'all-help', name: 'Well Read', description: 'Unlock every page in the Help viewer', when: () => false },

  // --- Maps and the editor ------------------------------------------------------------------
  { id: 'custom-map-cleared', name: 'Cartographer', description: 'Clear a wave on a custom map', when: (s) => s.customMap && s.clearedWaves > 0 },
  // Deferred: the editor is outside the run simulation.
  { id: 'editor-first', name: 'Draftsman', description: 'Place your first tile in the editor', when: () => false },
  { id: 'map-export', name: 'Shareware', description: 'Export a map code', when: () => false },
  { id: 'map-import', name: 'Import Duty', description: 'Load a map from a code', when: () => false },
  { id: 'fork-cleared', name: 'Split Decision', description: 'Clear wave 10 on The Fork', when: (s) => s.mapId === 'fork' && s.clearedWaves >= 10 },
  { id: 'ladder-cleared', name: 'Rung by Rung', description: 'Clear wave 10 on The Ladder', when: (s) => s.mapId === 'ladder' && s.clearedWaves >= 10 },

  // --- Shadow -------------------------------------------------------------------------------
  // Deferred: "10 unopened ads on screen" needs a simultaneous ad tally, then a loss.
  { id: 'shadow-ad-no-close', name: 'Customer Service', description: 'Lose a run with 10 unopened ads on screen', hidden: true, when: () => false },
  { id: 'shadow-zero-towers', name: 'Pacifist', description: 'Reach wave 5 with no towers and no clicks', hidden: true, when: (s) => s.wave >= 5 && s.towersBuilt === 0 && s.pointerHits === 0 },
  { id: 'shadow-all-walls', name: 'Wall Street', description: 'Build 40 walls in one run', hidden: true, when: (s) => s.wallsBuilt >= 40 },
  // Deferred: "sell every tower at once from a full board" needs a per-action board snapshot.
  { id: 'shadow-sell-all', name: 'Fire Sale', description: 'Sell every tower at once from a full board', hidden: true, when: () => false },
  // Deferred: "kill a boss while at 1 integrity" needs the kill-time integrity recorded.
  { id: 'shadow-1hp-boss', name: 'Photo Finish', description: 'Kill a boss while at 1 integrity', hidden: true, when: () => false },
  { id: 'shadow-pause', name: 'Coffee Break', description: 'Pause the game for 10 minutes', hidden: true, when: (s) => s.pausedTicks >= 36000 },
  // Deferred: tooltip hover time is view state, not sim state.
  { id: 'shadow-hover', name: 'Window Shopper', description: 'Hover a tooltip for 60 seconds', hidden: true, when: () => false },
  // Deferred: window size is view state.
  { id: 'shadow-resize', name: 'It Fits', description: 'Play a full wave in a 800×600 window', hidden: true, when: () => false },
  // Deferred: sound state is not carried on the run.
  { id: 'shadow-mute', name: 'Silent Running', description: 'Clear wave 50 with sound off', hidden: true, when: () => false },
  // Deferred: reload detection.
  { id: 'shadow-reload', name: 'Have You Tried Turning It Off', description: 'Reload mid-wave and finish it', hidden: true, when: () => false },
  // Deferred: "open every Help page without playing a wave" needs help-page tracking.
  { id: 'shadow-clippy', name: "It Looks Like You're Writing a Game", description: 'Open every Help page without playing a wave', hidden: true, when: () => false },
  // Deferred: screen-shake preference is not on the run.
  { id: 'shadow-monochrome', name: 'High Contrast', description: 'Finish a run with screen shake off', hidden: true, when: () => false },
  // Deferred: the browser clock is non-deterministic (a deliberate joke, left unwired).
  { id: 'shadow-owl', name: 'Night Shift', description: 'Clear a wave between 2 and 4 am local', hidden: true, when: () => false },
  { id: 'shadow-weekend', name: 'Weekend Warrior', description: 'Clear a wave on a Sunday', hidden: true, when: () => false },
  // Deferred: battery status needs the browser API.
  { id: 'shadow-flat-battery', name: 'Low Battery', description: 'Start a run while the OS reports battery below 10 %', hidden: true, when: () => false },
  // Deferred: "spawn 50 from the cheat menu, then lose" needs a cheat-spawn tally.
  { id: 'shadow-printer', name: 'Paper Jam', description: 'Spawn 50 enemies from the cheat menu, then lose', hidden: true, when: () => false },
  // Deferred: "reboot while at wave 1" needs the reboot action tied to the wave.
  { id: 'shadow-boots', name: 'Blue Screen', description: 'Reboot while at wave 1', hidden: true, when: () => false },
  { id: 'shadow-perfect-100', name: 'Immaculate', description: 'Reach wave 100 with no leaks, no repairs, no sells', hidden: true, when: (s) => s.wave >= 100 && s.leaks === 0 && s.repairsDone === 0 && s.towersSold === 0 },
  // Deferred: clearing all six shipped maps needs cross-run map completion.
  { id: 'shadow-every-map', name: 'Tour Guide', description: 'Clear a wave on all six shipped maps', hidden: true, when: () => false },
  // Deferred: "spend your last salvage on a tower that dies the same wave" needs per-tower death tracking.
  { id: 'shadow-broke', name: 'Zero Balance', description: 'Spend your last salvage on a tower that dies the same wave', hidden: true, when: () => false },
  // Deferred: help window state is view state.
  { id: 'shadow-help-clippy', name: 'Paperclip', description: 'Open the Help window during a boss fight', hidden: true, when: () => false },
  // Deferred: help drag is view state.
  { id: 'shadow-drag', name: 'Where Did It Go', description: 'Drag the Help window off screen and back', hidden: true, when: () => false },
  // Deferred: tooltip-open tracking is view state.
  { id: 'shadow-tooltip', name: 'Read the Manual', description: 'Open every tower tooltip in one run', hidden: true, when: () => false },
  // Deferred: "use God Mode and still lose" needs a loss under God Mode recorded.
  { id: 'shadow-cheat-lose', name: 'That Was Fair', description: 'Use God Mode and still lose', hidden: true, when: () => false },
];

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}

export function isShadowAchievement(id: string): boolean {
  return id.startsWith('shadow-');
}
