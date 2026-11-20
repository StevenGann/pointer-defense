/**
 * The desktop-ad tip pool (docs/ADS-TIPS.md §2.2).
 *
 * Content, not code: this file only names the tips and their order. The words live in the catalogue
 * (`src/i18n/en/ads.ts`) under `ads.tip.<id>`, so the pool stays locale-neutral and the smoke harness
 * can lay every tip out in every locale. The ids are identifiers: one appears on the live ad in the
 * run save, so they never change.
 */
export type AdTipId =
  | 'aa-flyers'
  | 'branches'
  | 'support-tiers'
  | 'sell-refund'
  | 'mesh-wall'
  | 'fog'
  | 'rush'
  | 'beacon'
  | 'marked-crit'
  | 'mass-upgrade';

/** The pool, in the order a run cycles through it. */
export const AD_TIPS: readonly AdTipId[] = [
  'aa-flyers',
  'branches',
  'support-tiers',
  'sell-refund',
  'mesh-wall',
  'fog',
  'rush',
  'beacon',
  'marked-crit',
  'mass-upgrade',
];

/** True for a valid tip id, for validating the tip carried on a restored ad. */
export function isAdTipId(v: unknown): v is AdTipId {
  return typeof v === 'string' && (AD_TIPS as readonly string[]).includes(v);
}
