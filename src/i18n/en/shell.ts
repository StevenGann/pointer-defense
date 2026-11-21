import type { Catalogue } from '../index.ts';

/**
 * Shell strings: the app chrome around the game — the main menu window, run dialogs and notices,
 * editor notices, the placement refusal reasons and the HUD tooltip one-liners that live in
 * `main.ts`, `mouse.ts` and `menuScreen.ts`.
 */
export const shell = {
  // Main menu window.
  'shell.menu.play': 'Play',
  'shell.menu.daily': 'Daily',
  'shell.menu.editor': 'Editor',
  'shell.menu.records': 'Records',
  'shell.menu.load': 'Load code',
  'shell.menu.wordmark': 'POINTER DEFENSE',
  'shell.menu.ready': 'Ready',
  'shell.menu.summary': 'Best {bestWave} · {runs} runs · {achievements}/118',
  'shell.menu.tips':
    'Tip: flyers ignore your maze  ·  Tip: Ctrl+click upgrades a whole row  ·  Tip: the pointer crits on weak points  ·  Tip: Restart Windows keeps your specs  ·  ',
  'shell.menu.shortcut.continue': 'C',
  'shell.menu.shortcut.play': 'Enter',
  'shell.menu.shortcut.daily': 'D',
  'shell.menu.shortcut.editor': 'E',
  'shell.menu.shortcut.records': 'R',
  'shell.menu.shortcut.load': 'L',

  // Map-selection gallery (docs/MAP-SELECT.md).
  'shell.maps.title': 'Select a map',
  'shell.maps.best': 'Best: wave {n}',
  'shell.maps.best.none': 'Not played',

  // Load-code dialog.
  'shell.load.title': 'Load code',
  'shell.load.ok': 'OK',
  'shell.load.cancel': 'Cancel',

  // Run labels and notices.
  'shell.continue': 'Wave {wave} — {map}',
  'shell.daily': 'Daily — {date}',
  'shell.achievement': 'Achievement: {name}',
  'shell.notice.popupEscaped': 'Pop-up left — no damage',
  'shell.notice.shutterOpen': 'Shutter {index} opened',
  'shell.notice.shutterClosed': 'Shutter {index} closed',
  'shell.notice.towerUnlocked': '{name} unlocked',
  'shell.notice.cheats': 'Cheats active — this run will not be recorded',

  // Confirmation dialogs.
  'shell.confirm.restartTitle': 'Restart Windows',
  'shell.confirm.restartBody': 'This closes the run and banks {points} Restore Points.',
  'shell.confirm.restart': 'Restart',
  'shell.confirm.newRunTitle': 'New Run',
  'shell.confirm.newRunBody': 'Start a new run? This discards the current run.',
  'shell.confirm.discardTitle': 'Start over',
  'shell.confirm.discardBody': 'Start over? The saved run at wave {wave} will be lost.',
  'shell.confirm.aboutTitle': 'About',
  'shell.confirm.aboutVersion': '{name} v{version}',
  'shell.confirm.newMapTitle': 'New map',
  'shell.confirm.newMapBody': 'Discard the current drawing and start a new map?',
  'shell.confirm.ok': 'OK',
  'shell.confirm.cancel': 'Cancel',
  'shell.confirm.close': 'Close',
  'shell.confirm.yes': 'Yes',
  'shell.confirm.no': 'No',

  // Editor notices.
  'shell.editor.codeCopied': 'Code copied',
  'shell.editor.loaded': 'Loaded "{name}"',
  'shell.editor.saved': 'Saved "{name}"',
  'shell.editor.cannotSave': 'Cannot save: {reason}',
  'shell.editor.untitled': 'Untitled',
  'shell.editor.newMap': 'New map',

  // Placement refusal reasons.
  'shell.refusal.blockedTile': 'That tile is blocked.',
  'shell.refusal.shutterTile': 'That tile is a shutter and cannot be built on.',
  'shell.refusal.occupied': 'There is already a tower there.',
  'shell.refusal.noSalvage': 'Not enough salvage for that tower.',
  'shell.refusal.sealShutter': 'That would seal the route when a shutter closes.',
  'shell.refusal.seal': 'That would seal the route.',
  'shell.unlockAtWave': '{name} unlocks at wave {wave}',
  'shell.gateLocked': 'Gate locked for {seconds} s',

  // HUD control tooltips.
  'shell.tooltip.override': 'Manual Override: every tower in range of the marked enemy drops its own priority and shoots it.',
  'shell.tooltip.noBuildRetarget': 'No-Build: towers cannot be retargeted this wave.',
  'shell.tooltip.auto': 'Auto: start the next wave 1.5 s after the board clears (holds while a tower repairs).',
  'shell.tooltip.restore': 'Open the Restore tree and spec shop.',
  'shell.tooltip.upgrades': 'Open Global Upgrades: one-shot purchases for this run, paid in salvage.',
} as const satisfies Catalogue;
