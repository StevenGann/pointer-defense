import type { Catalogue } from '../index.ts';

/**
 * Desktop-ad titles, reward lines and tips (docs/ADS-TIPS.md §3).
 *
 * The reward-line numbers (`+8 %`, `+40 %`, `-50 %`, `25`) are not baked in: they travel as
 * `{placeholders}` filled at the call site from the same effect constants the simulation reads
 * (`AD_DEFRAG_SALVAGE_PCT`, `AD_AUTOUPDATE_DAMAGE_MULT`, `AD_TIMEZONE_SPEED_MULT`,
 * `AD_SCREENSAVER_DAMAGE`), so a rebalance updates the text for free.
 */
export const ads = {
  'ads.kind.defrag.title': 'Defrag complete',
  'ads.kind.defrag.message': 'Close for +{pct}% salvage',
  'ads.kind.autoupdate.title': 'AutoUpdate',
  'ads.kind.autoupdate.message': 'Close for +{pct}% towers',
  'ads.kind.timezone.title': 'Time Zone Change',
  'ads.kind.timezone.message': 'Close for -{pct}% speed',
  'ads.kind.freeware.title': 'Freeware',
  'ads.kind.freeware.message': 'Close for a free Gun',
  'ads.kind.screensaver.title': 'Screensaver',
  'ads.kind.screensaver.message': 'Close for {damage} damage',
  'ads.kind.bluescreen.title': 'Blue Screen',
  'ads.kind.bluescreen.message': 'Close for nothing',

  'ads.tip.aa-flyers': 'AA towers only shoot flyers. Put them where the flights cross.',
  'ads.tip.branches': 'Most towers pick a branch at tier 3. The branches are different jobs.',
  'ads.tip.support-tiers': 'Walls and Repair stop at tier 3. The Cursor stops at tier 5.',
  'ads.tip.sell-refund': 'Selling returns 70% of what you spent. Walls return nothing.',
  'ads.tip.mesh-wall': 'Only a Mesh wall blocks flyers. Ordinary walls just bend the ground route.',
  'ads.tip.fog': "Fog cuts every tower's range by a fifth. Build tight that wave.",
  'ads.tip.rush': 'Rush waves close the spawn gap by a quarter. Front-load your kills.',
  'ads.tip.beacon': 'A Beacon raises the damage of every tower in its radius.',
  'ads.tip.marked-crit': 'Marked enemies crit more often. The weak point crits more often still.',
  'ads.tip.mass-upgrade': 'Ctrl+click a tower to buy every upgrade you can afford.',
} as const satisfies Catalogue;
