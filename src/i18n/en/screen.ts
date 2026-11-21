import type { Catalogue } from '../index.ts';

/**
 * Screen strings: the chrome drawn over the live run — the Help viewer, the boss announcement bars,
 * the pop-up window caption and the floating damage numbers.
 */
export const screen = {
  // Help viewer.
  'screen.help.title': 'Pointer Defense Help',
  'screen.help.nav.contents': 'Contents',
  'screen.help.nav.index': 'Index',
  'screen.help.nav.search': 'Search',
  'screen.help.undiscovered': 'Undiscovered',
  'screen.help.selectTopic': 'Select a topic from the contents',
  'screen.help.topicPath': '{category} › {page}',
  'screen.help.topic': 'Topic {topic} of {total}',
  'screen.help.searchNone': 'No topics found',
  'screen.help.printBlocked': 'Print was blocked by the browser',
  'screen.help.open': 'Open',
  'screen.help.print': 'Print',
  'screen.help.hideTabs': 'Hide tabs',
  'screen.help.back': 'Back',
  'screen.help.forward': 'Forward',
  'screen.help.home': 'Home',
  'screen.help.refresh': 'Refresh',
  'screen.help.locate': 'Locate',
  'screen.help.options': 'Options',
  'screen.help.tooltip.nav': 'Hide/Show tabs',

  // Boss bars.
  'screen.boss.new': 'NEW',
  'screen.boss.gimmick.grunt': 'shrugs off damage',
  'screen.boss.gimmick.runner': 'anything near it keeps pace',
  'screen.boss.gimmick.shielded': 'three layers of shielding',
  'screen.boss.gimmick.flyer': 'hatches flyers as it flies',
  'screen.boss.gimmick.armoured': 'plated and slow to chill',
  'screen.boss.gimmick.saboteur': 'shorts out towers as it passes',
  'screen.boss.gimmick.breacher': 'eats through your towers',

  // Pop-up window.
  'screen.board.popupTitle': 'Pop-up',
  'screen.board.popupMessage': 'This program has performed an illegal operation',

  // Floating damage numbers.
  'screen.number.shield': 'SHD {amount}',
  'screen.number.crit': 'CRIT {amount}',
} as const satisfies Catalogue;
