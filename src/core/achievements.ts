/**
 * The achievement catalog, the unlock rules, and the shared stats type.
 *
 * This file is pure data plus pure predicates. The id is the key: it names the save entry and the
 * art file, so it never changes. The catalog is generated from docs/ACHIEVEMENTS.md — the id, name
 * and description are copied verbatim; `when` reads the flat `AchievementStats` snapshot that
 * `state.ts` builds once per tick (plus the `Profile` for a few meta achievements). Every shipped
 * achievement has a live predicate; conditions the sim cannot observe (a hover, a resize, an editor
 * action) are recorded into the snapshot's `notified` set by the view via `notifyAchievement`.
 */

import { allHelpUnlocked, type Profile } from './save.ts';
import { t } from '../i18n/index.ts';

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

  // Per-wave snapshot rules (group A).
  towersOnBoard: number;
  clearedWallOnlyWave: boolean;
  clearedNoUpgradeWave: boolean;
  clearedTwoKinds: boolean;
  clearedNoSpendWave: boolean;
  clearedBossNoLeak: boolean;
  clearedSellAllWave: boolean;

  // Per-shot tallies (group B).
  maxBeamKills: number;
  maxChainKills: number;
  maxSplashKills: number;
  maxSlowCount: number;
  beaconBuffKill: boolean;
  maxCursorRepairs: number;

  // Profile counters (group C).
  lifetimeBossKillsByPointer: number;
  shippedMapsCleared: number;

  // Timers and flags (group D + the remaining shadows and meta).
  pointerIdleSeconds: number;
  idleTowerKilled: boolean;
  recentPointerKills: number;
  idleSeconds: number;
  autoWave: boolean;
  bossKilledByOverride: boolean;
  bossKilledAtOneIntegrity: boolean;
  notified: ReadonlySet<string>;
  runLost: boolean;
  runEnded: boolean;
  specTotal: number;
  dayOfWeek: number;
  clearedNoTowerWave: boolean;
  soldTowerSameWave: boolean;
  calledEarlyBeforeTower: boolean;
  wavesClearedSinceLeak: number;
  cheatSpawns: number;
  shadowBroke: boolean;
}

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** A shadow achievement has no cell on the grid until it fires (docs/ACHIEVEMENTS.md). */
  readonly hidden?: boolean;
  /**
   * Still awarded on a cheated run, and only for achievements whose condition *is* the cheating.
   * Everything else refuses a cheated run (docs/design.md 12.4).
   */
  readonly cheatOnly?: boolean;
  readonly when?: (s: AchievementStats, p: Profile) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- Pointer and the clicker ---------------------------------------------------------------
  { id: 'first-blood', name: t('ach.firstBlood.name'), description: t('ach.firstBlood.description'), when: (s) => s.kills > 0 },
  { id: 'sharpshooter', name: t('ach.sharpshooter.name'), description: t('ach.sharpshooter.description'), when: (s) => s.weakHits >= 100 },
  { id: 'weak-point-kills', name: t('ach.weakPointKills.name'), description: t('ach.weakPointKills.description'), when: (s) => s.weakKills >= 50 },
  { id: 'crit-hits', name: t('ach.critHits.name'), description: t('ach.critHits.description'), when: (s) => s.critHits >= 25 },
  { id: 'crit-100', name: t('ach.crit100.name'), description: t('ach.crit100.description'), when: (s) => s.critHits >= 100 },
  { id: 'pointer-1k', name: t('ach.pointer1k.name'), description: t('ach.pointer1k.description'), when: (s) => s.pointerHits >= 1000 },
  { id: 'click-combo', name: t('ach.clickCombo.name'), description: t('ach.clickCombo.description'), when: (s) => s.recentPointerKills >= 10 },
  { id: 'override', name: t('ach.override.name'), description: t('ach.override.description'), when: (s) => s.bossKilledByOverride },
  { id: 'pointer-only-wave', name: t('ach.pointerOnlyWave.name'), description: t('ach.pointerOnlyWave.description'), when: (s) => s.clearedNoTowerWave },
  { id: 'weak-point-10', name: t('ach.weakPoint10.name'), description: t('ach.weakPoint10.description'), when: (s) => s.weakHits >= 10 },
  { id: 'crit-first', name: t('ach.critFirst.name'), description: t('ach.critFirst.description'), when: (s) => s.critHits >= 1 && s.wave <= 1 },
  { id: 'overclock-max', name: t('ach.overclockMax.name'), description: t('ach.overclockMax.description'), when: (s) => s.overclockMax },
  { id: 'click-idle', name: t('ach.clickIdle.name'), description: t('ach.clickIdle.description'), when: (s) => s.pointerIdleSeconds >= 60 && s.idleTowerKilled },
  { id: 'pointer-boss-10', name: t('ach.pointerBoss10.name'), description: t('ach.pointerBoss10.description'), when: (s) => s.lifetimeBossKillsByPointer >= 10 },

  // --- Towers -------------------------------------------------------------------------------
  { id: 'five-tier-five', name: t('ach.fiveTierFive.name'), description: t('ach.fiveTierFive.description'), when: (s) => s.tierFiveCount >= 5 },
  { id: 'beacon-field', name: t('ach.beaconField.name'), description: t('ach.beaconField.description'), when: (s) => s.beaconCount >= 10 },
  { id: 'maxed-branch', name: t('ach.maxedBranch.name'), description: t('ach.maxedBranch.description'), when: (s) => s.maxedBranch },
  { id: 'aa-flak', name: t('ach.aaFlak.name'), description: t('ach.aaFlak.description'), when: (s) => s.aaFlak },
  { id: 'mine-layer', name: t('ach.mineLayer.name'), description: t('ach.mineLayer.description'), when: (s) => s.minesTriggered >= 25 },
  { id: 'wall-only-wave', name: t('ach.wallOnlyWave.name'), description: t('ach.wallOnlyWave.description'), when: (s) => s.clearedWallOnlyWave },
  { id: 'toggle-master', name: t('ach.toggleMaster.name'), description: t('ach.toggleMaster.description'), when: (s) => s.toggles >= 50 },
  { id: 'repair-shop', name: t('ach.repairShop.name'), description: t('ach.repairShop.description'), when: (s) => s.salvageSpentOnRepairs >= 2000 },
  { id: 'tower-zoo', name: t('ach.towerZoo.name'), description: t('ach.towerZoo.description'), when: (s) => s.towerKinds >= 10 },
  { id: 'tier-five-first', name: t('ach.tierFiveFirst.name'), description: t('ach.tierFiveFirst.description'), when: (s) => s.maxTowerTier >= 5 },
  { id: 'sell-10', name: t('ach.sell10.name'), description: t('ach.sell10.description'), when: (s) => s.towersSold >= 10 },
  { id: 'no-upgrade-wave', name: t('ach.noUpgradeWave.name'), description: t('ach.noUpgradeWave.description'), when: (s) => s.clearedNoUpgradeWave },
  { id: 'laser-chain', name: t('ach.laserChain.name'), description: t('ach.laserChain.description'), when: (s) => s.maxBeamKills >= 5 },
  { id: 'frost-lock', name: t('ach.frostLock.name'), description: t('ach.frostLock.description'), when: (s) => s.maxSlowCount >= 12 },
  { id: 'taser-chain', name: t('ach.taserChain.name'), description: t('ach.taserChain.description'), when: (s) => s.maxChainKills >= 4 },
  { id: 'cannon-splash', name: t('ach.cannonSplash.name'), description: t('ach.cannonSplash.description'), when: (s) => s.maxSplashKills >= 6 },
  { id: 'cursor-first', name: t('ach.cursorFirst.name'), description: t('ach.cursorFirst.description'), when: (s) => s.cursorBuilt },
  { id: 'cursor-repair', name: t('ach.cursorRepair.name'), description: t('ach.cursorRepair.description'), when: (s) => s.maxCursorRepairs >= 5 },
  { id: 'beacon-buff', name: t('ach.beaconBuff.name'), description: t('ach.beaconBuff.description'), when: (s) => s.beaconBuffKill },
  { id: 'one-kind', name: t('ach.oneKind.name'), description: t('ach.oneKind.description'), when: (s) => s.clearedWaves > 0 && s.towerKinds === 1 },
  { id: 'two-kinds', name: t('ach.twoKinds.name'), description: t('ach.twoKinds.description'), when: (s) => s.clearedTwoKinds },
  { id: 'upgrade-first', name: t('ach.upgradeFirst.name'), description: t('ach.upgradeFirst.description'), when: (s) => s.upgradesBought >= 1 },
  { id: 'branch-first', name: t('ach.branchFirst.name'), description: t('ach.branchFirst.description'), when: (s) => s.branches >= 1 },
  { id: 'sell-tower-first', name: t('ach.sellTowerFirst.name'), description: t('ach.sellTowerFirst.description'), when: (s) => s.towersSold >= 1 },

  // --- Economy ------------------------------------------------------------------------------
  { id: 'salvage-peak', name: t('ach.salvagePeak.name'), description: t('ach.salvagePeak.description'), when: (s) => s.salvagePeak >= 1000 },
  { id: 'salvage-10k', name: t('ach.salvage10k.name'), description: t('ach.salvage10k.description'), when: (s) => s.salvagePeak >= 10000 },
  { id: 'earn-100k', name: t('ach.earn100k.name'), description: t('ach.earn100k.description'), when: (s) => s.earned >= 100000 },
  { id: 'no-spend-wave', name: t('ach.noSpendWave.name'), description: t('ach.noSpendWave.description'), when: (s) => s.clearedNoSpendWave },
  { id: 'ad-collector', name: t('ach.adCollector.name'), description: t('ach.adCollector.description'), when: (s) => s.adsClosed >= 10 },
  { id: 'ad-ignore', name: t('ach.adIgnore.name'), description: t('ach.adIgnore.description'), when: (s) => s.adsExpired >= 10 },
  { id: 'early-call-streak', name: t('ach.earlyCallStreak.name'), description: t('ach.earlyCallStreak.description'), when: (s) => s.earlyCallStreak >= 3 },
  { id: 'early-call-10', name: t('ach.earlyCall10.name'), description: t('ach.earlyCall10.description'), when: (s) => s.earlyCalls >= 10 },
  { id: 'early-call-wave-1', name: t('ach.earlyCallWave1.name'), description: t('ach.earlyCallWave1.description'), hidden: true, when: (s) => s.calledEarlyBeforeTower },
  { id: 'idle-hour', name: t('ach.idleHour.name'), description: t('ach.idleHour.description'), when: (s) => s.autoWave && s.idleSeconds >= 300 },
  { id: 'sell-profit', name: t('ach.sellProfit.name'), description: t('ach.sellProfit.description'), hidden: true, when: (s) => s.soldTowerSameWave },
  { id: 'no-sell', name: t('ach.noSell.name'), description: t('ach.noSell.description'), when: (s) => s.wave >= 20 && s.towersSold === 0 },

  // --- Waves and survival -------------------------------------------------------------------
  { id: 'clean-wave', name: t('ach.cleanWave.name'), description: t('ach.cleanWave.description'), when: (s) => s.cleanWave },
  { id: 'flawless-wave', name: t('ach.flawlessWave.name'), description: t('ach.flawlessWave.description'), when: (s) => s.perfectWaves > 0 },
  { id: 'flawless-10', name: t('ach.flawless10.name'), description: t('ach.flawless10.description'), when: (s) => s.perfectWaves >= 10 },
  { id: 'perfect-run', name: t('ach.perfectRun.name'), description: t('ach.perfectRun.description'), when: (s) => s.wave >= 50 && s.leaks === 0 },
  { id: 'long-road', name: t('ach.longRoad.name'), description: t('ach.longRoad.description'), when: (s) => s.routeLength >= 50 },
  { id: 'maze-100', name: t('ach.maze100.name'), description: t('ach.maze100.description'), when: (s) => s.routeLength >= 100 },
  { id: 'wave-25', name: t('ach.wave25.name'), description: t('ach.wave25.description'), when: (s) => s.wave >= 25 },
  { id: 'wave-50', name: t('ach.wave50.name'), description: t('ach.wave50.description'), when: (s) => s.wave >= 50 },
  { id: 'wave-100', name: t('ach.wave100.name'), description: t('ach.wave100.description'), when: (s) => s.wave >= 100 },
  { id: 'endless-150', name: t('ach.endless150.name'), description: t('ach.endless150.description'), when: (s) => s.endlessWave >= 150 },
  { id: 'endless-200', name: t('ach.endless200.name'), description: t('ach.endless200.description'), when: (s) => s.endlessWave >= 200 },
  { id: 'integrity-1', name: t('ach.integrity1.name'), description: t('ach.integrity1.description'), when: (s) => s.integrity === 1 },
  { id: 'speed-3', name: t('ach.speed3.name'), description: t('ach.speed3.description'), when: (s) => s.wavesAtThreeSpeed >= 1 },
  { id: 'wave-1-no-damage', name: t('ach.wave1NoDamage.name'), description: t('ach.wave1NoDamage.description'), when: (s) => s.clearedWave1NoLeak },
  { id: 'leak-recovery', name: t('ach.leakRecovery.name'), description: t('ach.leakRecovery.description'), hidden: true, when: (s) => s.wavesClearedSinceLeak >= 5 },

  // --- Bosses -------------------------------------------------------------------------------
  { id: 'boss-by-pointer', name: t('ach.bossByPointer.name'), description: t('ach.bossByPointer.description'), when: (s) => s.bossKilledByPointer },
  { id: 'milestone-boss-pointer', name: t('ach.milestoneBossPointer.name'), description: t('ach.milestoneBossPointer.description'), when: (s) => s.milestoneBossByPointer },
  { id: 'boss-10', name: t('ach.boss10.name'), description: t('ach.boss10.description'), when: (s) => s.bossesKilled >= 10 },
  { id: 'boss-first-wave', name: t('ach.bossFirstWave.name'), description: t('ach.bossFirstWave.description'), when: (s) => s.bossesKilled >= 1 && s.wave < 20 },
  { id: 'shield-break-5', name: t('ach.shieldBreak5.name'), description: t('ach.shieldBreak5.description'), when: (s) => s.shieldsBroken >= 5 },
  { id: 'carrier-brood', name: t('ach.carrierBrood.name'), description: t('ach.carrierBrood.description'), when: (s) => s.killedCarrier },
  { id: 'dreadnought-kill', name: t('ach.dreadnoughtKill.name'), description: t('ach.dreadnoughtKill.description'), when: (s) => s.killedDreadnought },
  { id: 'wirecutter-kill', name: t('ach.wirecutterKill.name'), description: t('ach.wirecutterKill.description'), when: (s) => s.killedWirecutter },
  { id: 'ram-kill', name: t('ach.ramKill.name'), description: t('ach.ramKill.description'), when: (s) => s.killedRam },
  { id: 'boss-no-leak', name: t('ach.bossNoLeak.name'), description: t('ach.bossNoLeak.description'), when: (s) => s.clearedBossNoLeak },

  // --- Prestige, meta and the machine -------------------------------------------------------
  { id: 'reboot-50', name: t('ach.reboot50.name'), description: t('ach.reboot50.description'), when: (s) => s.specTotal >= 50 },
  { id: 'two-reboots', name: t('ach.twoReboots.name'), description: t('ach.twoReboots.description'), when: (s) => s.rebootCount >= 2 },
  { id: 'reboot-10', name: t('ach.reboot10.name'), description: t('ach.reboot10.description'), when: (s) => s.rebootCount >= 10 },
  { id: 'specs-banked', name: t('ach.specsBanked.name'), description: t('ach.specsBanked.description'), when: (s) => s.rp > 0 },
  { id: 'first-rp', name: t('ach.firstRp.name'), description: t('ach.firstRp.description'), when: (s) => s.prestigeLevel > 0 },
  { id: 'rp-100', name: t('ach.rp100.name'), description: t('ach.rp100.description'), when: (s) => s.prestigeLevel >= 100 },
  { id: 'prestige-25', name: t('ach.prestige25.name'), description: t('ach.prestige25.description'), when: (s) => s.prestigeLevel >= 25 },
  { id: 'tree-tier-3', name: t('ach.treeTier3.name'), description: t('ach.treeTier3.description'), when: (s) => s.maxTreeTier >= 3 },
  { id: 'tree-complete', name: t('ach.treeComplete.name'), description: t('ach.treeComplete.description'), when: (s) => s.treesFullyUpgraded },
  { id: 'fast-boot-40', name: t('ach.fastBoot40.name'), description: t('ach.fastBoot40.description'), when: (s) => s.startingWave >= 40 },
  { id: 'no-cheats-100', name: t('ach.noCheats100.name'), description: t('ach.noCheats100.description'), when: (s) => s.wave >= 100 && !s.cheatsUsed },
  { id: 'all-help', name: t('ach.allHelp.name'), description: t('ach.allHelp.description'), when: (_s, p) => allHelpUnlocked(p) },

  // --- Maps and the editor ------------------------------------------------------------------
  { id: 'custom-map-cleared', name: t('ach.customMapCleared.name'), description: t('ach.customMapCleared.description'), when: (s) => s.customMap && s.clearedWaves > 0 },
  { id: 'editor-first', name: t('ach.editorFirst.name'), description: t('ach.editorFirst.description'), when: (s) => s.notified.has('editor-first') },
  { id: 'map-export', name: t('ach.mapExport.name'), description: t('ach.mapExport.description'), when: (s) => s.notified.has('map-export') },
  { id: 'map-import', name: t('ach.mapImport.name'), description: t('ach.mapImport.description'), when: (s) => s.notified.has('map-import') },
  { id: 'fork-cleared', name: t('ach.forkCleared.name'), description: t('ach.forkCleared.description'), when: (s) => s.mapId === 'fork' && s.clearedWaves >= 10 },
  { id: 'ladder-cleared', name: t('ach.ladderCleared.name'), description: t('ach.ladderCleared.description'), when: (s) => s.mapId === 'ladder' && s.clearedWaves >= 10 },

  // --- Shadow -------------------------------------------------------------------------------
  { id: 'shadow-ad-no-close', name: t('ach.shadowAdNoClose.name'), description: t('ach.shadowAdNoClose.description'), hidden: true, when: (s) => s.adsExpired >= 10 && s.runLost },
  { id: 'shadow-zero-towers', name: t('ach.shadowZeroTowers.name'), description: t('ach.shadowZeroTowers.description'), hidden: true, when: (s) => s.wave >= 5 && s.towersBuilt === 0 && s.pointerHits === 0 },
  { id: 'shadow-all-walls', name: t('ach.shadowAllWalls.name'), description: t('ach.shadowAllWalls.description'), hidden: true, when: (s) => s.wallsBuilt >= 40 },
  { id: 'shadow-sell-all', name: t('ach.shadowSellAll.name'), description: t('ach.shadowSellAll.description'), hidden: true, when: (s) => s.clearedSellAllWave },
  { id: 'shadow-1hp-boss', name: t('ach.shadow1hpBoss.name'), description: t('ach.shadow1hpBoss.description'), hidden: true, when: (s) => s.bossKilledAtOneIntegrity },
  { id: 'shadow-pause', name: t('ach.shadowPause.name'), description: t('ach.shadowPause.description'), hidden: true, when: (s) => s.pausedTicks >= 36000 },
  { id: 'shadow-hover', name: t('ach.shadowHover.name'), description: t('ach.shadowHover.description'), hidden: true, when: (s) => s.notified.has('shadow-hover') },
  { id: 'shadow-resize', name: t('ach.shadowResize.name'), description: t('ach.shadowResize.description'), hidden: true, when: (s) => s.notified.has('shadow-resize') },
  { id: 'shadow-mute', name: t('ach.shadowMute.name'), description: t('ach.shadowMute.description'), hidden: true, when: (s, p) => !p.soundOn && s.clearedWaves >= 50 },
  { id: 'shadow-reload', name: t('ach.shadowReload.name'), description: t('ach.shadowReload.description'), hidden: true, when: (s) => s.notified.has('shadow-reload') },
  { id: 'shadow-clippy', name: t('ach.shadowClippy.name'), description: t('ach.shadowClippy.description'), hidden: true, when: (s) => s.notified.has('shadow-clippy') },
  { id: 'shadow-monochrome', name: t('ach.shadowMonochrome.name'), description: t('ach.shadowMonochrome.description'), hidden: true, when: (s, p) => !p.shakeOn && s.runEnded },
  { id: 'shadow-owl', name: t('ach.shadowOwl.name'), description: t('ach.shadowOwl.description'), hidden: true, when: (s) => s.timeOfDayHour >= 2 && s.timeOfDayHour < 4 && s.clearedWaves > 0 },
  { id: 'shadow-weekend', name: t('ach.shadowWeekend.name'), description: t('ach.shadowWeekend.description'), hidden: true, when: (s) => s.dayOfWeek === 0 && s.clearedWaves > 0 },
  { id: 'shadow-flat-battery', name: t('ach.shadowFlatBattery.name'), description: t('ach.shadowFlatBattery.description'), hidden: true, when: (s) => s.notified.has('shadow-flat-battery') },
  { id: 'shadow-boots', name: t('ach.shadowBoots.name'), description: t('ach.shadowBoots.description'), hidden: true, when: (s) => s.notified.has('shadow-boots') },
  { id: 'shadow-perfect-100', name: t('ach.shadowPerfect100.name'), description: t('ach.shadowPerfect100.description'), hidden: true, when: (s) => s.wave >= 100 && s.leaks === 0 && s.repairsDone === 0 && s.towersSold === 0 },
  { id: 'shadow-every-map', name: t('ach.shadowEveryMap.name'), description: t('ach.shadowEveryMap.description'), hidden: true, when: (s) => s.shippedMapsCleared >= 6 },
  { id: 'shadow-help-clippy', name: t('ach.shadowHelpClippy.name'), description: t('ach.shadowHelpClippy.description'), hidden: true, when: (s) => s.notified.has('shadow-help-clippy') },
  { id: 'shadow-drag', name: t('ach.shadowDrag.name'), description: t('ach.shadowDrag.description'), hidden: true, when: (s) => s.notified.has('shadow-drag') },
  { id: 'shadow-tooltip', name: t('ach.shadowTooltip.name'), description: t('ach.shadowTooltip.description'), hidden: true, when: (s) => s.notified.has('shadow-tooltip') },
  { id: 'shadow-printer', name: t('ach.shadowPrinter.name'), description: t('ach.shadowPrinter.description'), hidden: true, cheatOnly: true, when: (s) => s.cheatSpawns >= 50 && s.runLost },
  { id: 'shadow-cheat-lose', name: t('ach.shadowCheatLose.name'), description: t('ach.shadowCheatLose.description'), hidden: true, cheatOnly: true, when: (s) => s.cheatsUsed && s.integrity === 0 && s.runLost },
  { id: 'shadow-console', name: t('ach.shadowConsole.name'), description: t('ach.shadowConsole.description'), hidden: true, cheatOnly: true, when: (s) => s.cheatsUsed },
  { id: 'shadow-broke', name: t('ach.shadowBroke.name'), description: t('ach.shadowBroke.description'), hidden: true, when: (s) => s.shadowBroke },
];

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}

export function isShadowAchievement(id: string): boolean {
  return id.startsWith('shadow-');
}
