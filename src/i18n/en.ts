import type { Catalogue } from './index.ts';

/**
 * The English catalogue — the first migration slice (docs/LOCALIZATION.md §Migration order).
 *
 * This holds only what the first slice moves: the menu-bar words, every item in the File / View /
 * Cheats / Help menus, the status-bar hint lines, and the window title. Later slices grow this file
 * key by key; every key here is referenced by code (enforced by the i18n test suite).
 */
export const en = {
  // Menu bar words.
  'menu.file': 'File',
  'menu.view': 'View',
  'menu.cheats': 'Cheats',
  'menu.help': 'Help',

  // File menu.
  'menu.file.restart': 'Restart Windows',
  'menu.file.restartWave50': 'Restart Windows (wave 50)',
  'menu.file.newRun': 'New Run',
  'menu.file.exit': 'Exit',

  // View menu.
  'menu.view.records': 'Records',
  'menu.view.shakeOn': 'Screen shake: On',
  'menu.view.shakeOff': 'Screen shake: Off',

  // Cheats menu. The spawn column's rows are enemy names, which are data, not text.
  'menu.cheats.godMode': 'God Mode',
  'menu.cheats.killAll': 'Kill All',
  'menu.cheats.spawn': 'Spawn',

  // Help menu.
  'menu.help.show': 'Show Help',
  'menu.help.soundOn': 'Sound: On',
  'menu.help.soundOff': 'Sound: Off',
  'menu.help.volumeLow': 'Volume: Low',
  'menu.help.volumeMed': 'Volume: Medium',
  'menu.help.volumeHigh': 'Volume: High',
  'menu.help.achievements': 'Achievements',
  'menu.help.about': 'About',

  // Status-bar hints.
  'status.pickTower': 'Pick a tower, then click a tile',
  'status.startWave': 'Click Start Wave when you are ready',
  'status.shoot': 'Click enemies to shoot — aim for the notch',
  'status.callEarly': 'Call the next wave early for a salvage bonus — two waves at once',
  'status.laneBroke': 'The lane broke. Click Restart to try again',
  'status.victory': 'All waves cleared!',
  'status.placeTower': 'Click a tile to place {name} — right-click to cancel',
  'status.inspectTower': 'Click Upgrade, choose a branch, or sell — right-click to deselect',
  'status.contextHelp': 'Click something to read about it — Esc cancels',

  // Window title.
  'window.title': 'Pointer Defense',
} as const satisfies Catalogue;
