/**
 * Number formatting for everything the player reads.
 *
 * Design rule: numbers get large, but abbreviate only above a million, never below. Below that the
 * exact figure with thousands separators is more legible than "12.3K" and keeps small purchases
 * honest. Separators are fixed to commas (not locale-dependent) so the 1997 look is consistent.
 */

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function withSeparators(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.floor(Math.abs(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  const abs = Math.abs(n);
  if (abs <= 1_000_000) return withSeparators(Math.floor(n));
  let tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(abs) / 3));
  let scaled = n / 10 ** (tier * 3);
  // Rounding can carry 999.96M up to "1000M"; promote it to 1.00B instead.
  if (Math.abs(scaled) >= 999.5 && tier < SUFFIXES.length - 1) {
    tier++;
    scaled /= 1000;
  }
  // 3 significant figures: 1.23M, 12.3M, 123M.
  const s = Math.abs(scaled) >= 100 ? scaled.toFixed(0) : Math.abs(scaled) >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
  return `${s}${SUFFIXES[tier]}`;
}
