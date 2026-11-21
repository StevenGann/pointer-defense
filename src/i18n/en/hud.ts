import type { Catalogue } from '../index.ts';

/** HUD chrome: the status bar, readouts, tower detail pane, build palette and end-of-run modals. */
export const hud = {
  // Status bar readouts.
  'hud.salvage': '${amount}',
  'hud.wave': 'Wave {wave}',
  'hud.waveOf': 'Wave {wave} / {total}',
  'hud.waveDaily': 'Wave {wave} / {total} · Daily',
  'hud.waveModifiers': ' · {modifiers}',
  'hud.speed': '×{speed}',
  'hud.perfFrameMs': '{ms} ms',
  'hud.perfFps': '{fps}/s',
  'hud.perfQuality': 'Q: {quality}',
  'hud.buffRow': '{name} — {seconds} s',

  // Global upgrades rows.
  'hud.upgradesNone': 'Upgrades — none yet',
  'hud.upgradesAllOwned': 'Upgrades — all owned',
  'hud.upgradesNew': 'Upgrades — {count} new',
  'hud.restoreRow': 'Restore — {rp} RP',

  // Right-column sections.
  'hud.compositionEntry': '{count} x {kind}',
  'hud.compositionMods': 'mod: {modifiers}',
  'hud.compositionBoss': 'BOSS: {name}',
  'hud.nextWaveTitle': 'NEXT WAVE',
  'hud.killsTitle': 'KILLS',
  'hud.killsByTower': 'by towers: {count}',
  'hud.killsByPointer': 'by pointer: {count}',
  'hud.killsPointerBonus': 'pointer kills x{bonus}',
  'hud.globalUpgradesTitle': 'GLOBAL UPGRADES',
  'hud.pointerTitle': 'POINTER',

  // Pointer section.
  'hud.pointerOverclock': 'Overclock {level} / {ceiling}',
  'hud.pointerOverclockNone': 'Overclock —',
  'hud.pointerCrit': 'Crit {crit}% · mark {mark}% · weak {weak}%',
  'hud.pointerNameClick': '{name} · click {damage}',
  'hud.pointerUpgrade': 'Upgrade ${cost}',
  'hud.maxLevel': 'Max level',
  'hud.override': 'Override',

  // Tower detail pane.
  'hud.towerName': '{name}  T{tier}',
  'hud.towerBranch': '{branch}',
  'hud.towerOffline': ' — OFFLINE',
  'hud.wallHp': 'HP {hp}',
  'hud.wallHpMax': 'HP {hp}/{max}',
  'hud.idle': 'Idle',
  'hud.cursorStats': '{rate}/s  dmg {damage}  rng {radius}',
  'hud.repairStats': '{heal} HP/s  rng {radius}  healing {count}',
  'hud.combatStats': 'dmg {damage}  rng {range}',
  'hud.route': 'Route: {count} tiles',
  'hud.synergy.synced': 'Synced · {count} towers',
  'hud.synergy.spotted': 'Spotted · range {range}',
  'hud.synergy.syncedSpotted': 'Synced · {count} · range {range}',
  'hud.target': 'Target',
  'hud.upgrade': 'Upgrade ${cost}',
  'hud.repairing': 'Repairing — {seconds} s',
  'hud.noDamage': 'No damage',
  'hud.repair': 'Repair {hp} HP  ${cost}',
  'hud.sell': 'Sell ${amount}',
  'hud.towerButton': '{name}  ${cost}',
  'hud.branchWide': 'Wide',

  // Left-panel readouts and buttons.
  'hud.integrity': 'Integrity: {current}/{max}',
  'hud.mapNext': 'Next',
  'hud.mapLabel': 'MAP  {name}',
  'hud.startWave': 'Start Wave {wave}',
  'hud.callWave': 'Call Wave {wave}  +${bonus}',
  'hud.auto': 'Auto',
  'hud.combo': 'COMBO x{multiplier}',

  // Status chips.
  'hud.cheats': 'CHEATS',
  'hud.paused': 'PAUSED',

  // End-of-run modals.
  'hud.gameOver': 'Game Over',
  'hud.gameOverMessage': 'The lane broke at wave {wave}.',
  'hud.mainMenu': 'Main Menu',
  'hud.victory': 'Victory',
  'hud.victoryDaily': 'Daily complete — all thirty waves cleared.',
  'hud.victoryAll': 'All one hundred waves cleared.',
  'hud.victoryKills': 'Kills — towers {tower} · pointer {pointer}',
  'hud.victorySalvage': 'Salvage earned: ${earned}',
  'hud.victoryIntegrity': 'Integrity remaining: {integrity}',
  'hud.endless': 'Endless',
  'hud.restartWindows': 'Restart Windows',
} as const satisfies Catalogue;
