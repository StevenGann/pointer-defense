import { Text } from 'pixi.js';

/**
 * Text measurement, in one place.
 *
 * Three views lay out text by its rendered width (the menu bar, dialogs and the HUD), so the
 * measurement lives here rather than in any one of them and cannot drift from the font they draw
 * with.
 *
 * In a browser this asks Pixi for the real width. Headless — the smoke harness has no canvas to
 * rasterise text — it estimates per glyph, and the estimate is script-aware: a Han, Hangul or
 * full-width glyph occupies an em, Latin and Cyrillic a little over half of one. A flat
 * `length * 0.6 em` estimate is what let the Chinese menu words run into each other, because
 * `文件` measured as two Latin characters when it draws as two squares.
 */

export const FONT = 'Tahoma, Verdana, Geneva, sans-serif';

const TEXT_WIDTH_CACHE_MAX = 256;
const cache = new Map<string, number>();

let metricsText: Text | null = null;

/** True for glyphs that draw one em wide: Han, Kana, Hangul, full-width forms, emoji. */
function isWideGlyph(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function estimateWidth(text: string, size: number): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    width += isWideGlyph(cp) ? size : size * 0.6;
  }
  return Math.ceil(width);
}

/** Measure a string with the font the views draw with, without adding it to the scene. */
export function textWidth(text: string, size: number): number {
  const key = `${size}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let width: number;
  if (typeof document === 'undefined') {
    width = estimateWidth(text, size);
  } else {
    if (!metricsText) {
      metricsText = new Text({ text: '', style: { fontFamily: FONT, fontSize: size } });
    }
    metricsText.style.fontSize = size;
    metricsText.text = text;
    width = metricsText.width;
  }

  if (cache.size >= TEXT_WIDTH_CACHE_MAX) cache.clear();
  cache.set(key, width);
  return width;
}

/** Drop the measurement cache. The smoke harness switches locales and would otherwise reuse widths. */
export function clearTextWidthCache(): void {
  cache.clear();
}
