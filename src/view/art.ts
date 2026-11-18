import { Texture } from 'pixi.js';
import { liveDevicePixelRatio } from './screen.ts';

/**
 * The SVG art pipeline: a manifest of every fixed asset, a rasterising loader, and a texture cache.
 *
 * Fixed art lives in `public/art/` as hand-editable SVGs (see `public/art/README.md` for the contract
 * an artist works to). The loader fetches each SVG once, decodes it into an `Image`, and rasterises it
 * into an offscreen canvas at the exact device-pixel size the sprite needs, so the vector stays crisp
 * at any DPI. Runtime effects (damage flashes, offline desaturation) are applied to the resulting
 * sprite with a tint or filter, never baked into the file — colour belongs to the file.
 *
 * The manifest is the single source of truth. A missing or malformed entry logs a warning and the
 * sprite resolves to `null`, so the caller falls back to its procedural drawing for that kind: a
 * half-finished art pass degrades instead of crashing. The manifest/reality diff is asserted in
 * `scripts/smoke.mjs`, so an unreferenced SVG or a listed-but-absent one fails the smoke run.
 */

export type ArtCategory = 'enemies' | 'towers' | 'branches' | 'board';

export interface ArtEntry {
  /** The unique asset name, e.g. `grunt`, `gun-base`, `gun-marksman`, `tile`. */
  readonly name: string;
  readonly category: ArtCategory;
  /** Path relative to `public/art/`, forward slashes, no leading slash. */
  readonly file: string;
}

/** The SVG viewBox contract: every asset is drawn centred in a 32x32 box. */
export const ART_VIEWBOX = 32;
/** The silhouette is meant to fill roughly this many of the 32 viewBox pixels (centred). */
export const ART_SILHOUETTE = 28;

const ENEMY_KINDS = ['grunt', 'runner', 'shielded', 'flyer', 'armoured', 'saboteur', 'breacher', 'boss'] as const;

/** Towers ship a base plinth (never rotates) and, for those with a barrel, a turret (rotates). */
const TOWER_BASE_KINDS = ['gun', 'cannon', 'laser', 'taser', 'frost', 'beacon', 'cursor', 'repair', 'wall'] as const;
const TOWER_TURRET_KINDS = ['gun', 'cannon', 'laser', 'taser', 'frost'] as const;

/** Branch marks, one file each. Wall and repair branches carry their identity in the base, not here. */
const BRANCH_NAMES: Readonly<Record<string, Readonly<Partial<Record<string, string>>>>> = {
  gun: { A: 'gun-marksman', B: 'gun-repeater' },
  cannon: { A: 'cannon-mortar', B: 'cannon-minesweeper' },
  laser: { A: 'laser-focus', B: 'laser-prism' },
  taser: { A: 'taser-arc', B: 'taser-overload' },
  frost: { A: 'frost-deep-freeze', B: 'frost-shard' },
  beacon: { A: 'beacon-command', B: 'beacon-relay' },
  cursor: { A: 'cursor-overclock', B: 'cursor-wide-search', C: 'cursor-maintenance' },
};

const BOARD_NAMES = ['tile', 'path-tile', 'obstacle', 'block'] as const;

function entries(category: ArtCategory, dir: string, names: readonly string[]): ArtEntry[] {
  return names.map((name) => ({ name, category, file: `${dir}/${name}.svg` }));
}

/** Every fixed asset the game can load, across all three art phases. */
export const ART_MANIFEST: readonly ArtEntry[] = [
  ...entries('enemies', 'enemies', ENEMY_KINDS),
  ...entries('towers', 'towers', TOWER_BASE_KINDS.map((k) => `${k}-base`)),
  ...entries('towers', 'towers', TOWER_TURRET_KINDS.map((k) => `${k}-turret`)),
  ...entries('branches', 'branches', Object.values(BRANCH_NAMES).flatMap((m) => Object.values(m)) as string[]),
  ...entries('board', 'board', BOARD_NAMES),
];

const MANIFEST_BY_NAME: ReadonlyMap<string, ArtEntry> = new Map(ART_MANIFEST.map((e) => [e.name, e]));

/** The manifest entry for an asset name, or undefined when the name is not in the manifest. */
export function manifestEntry(name: string): ArtEntry | undefined {
  return MANIFEST_BY_NAME.get(name);
}

/** The asset name for an enemy kind, or null for kinds that stay runtime (the Pop-up). */
export function artNameForEnemy(kind: string): string | null {
  return (ENEMY_KINDS as readonly string[]).includes(kind) ? kind : null;
}

/** The plinth asset for a tower kind (`<kind>-base`). */
export function artNameForTowerBase(kind: string): string {
  return `${kind}-base`;
}

/** The barrel asset for a tower kind, or null when that kind ships no turret (Beacon, Cursor, Repair, Wall). */
export function artNameForTowerTurret(kind: string): string | null {
  return (TOWER_TURRET_KINDS as readonly string[]).includes(kind) ? `${kind}-turret` : null;
}

/** The branch-mark asset for a tower branch, or null when the branch (or kind) carries no mark. */
export function artNameForBranch(kind: string, branch: string | null): string | null {
  if (branch === null) return null;
  return BRANCH_NAMES[kind]?.[branch] ?? null;
}

/** The public URL of an asset file, honouring the Vite `base` so GitHub Pages resolves it. */
export function artUrl(file: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}art/${file}`;
}

/** The exact device-pixel size to rasterise a `logicalPx` asset at for a given ratio. */
export function rasterPixelSize(logicalPx: number, dpr: number): number {
  return Math.max(1, Math.round(logicalPx * dpr));
}

/** The texture cache key for an asset at a given device-pixel size. */
export function cacheKey(name: string, pixelSize: number): string {
  return `${name}@${pixelSize}`;
}

/** Logical (CSS) px a sprite must span so its silhouette covers `bodyPx` px (the viewBox padding is 32/28). */
export function artSpriteSize(bodyPx: number): number {
  return bodyPx * (ART_VIEWBOX / ART_SILHOUETTE);
}

// --- Loader state ------------------------------------------------------------------------------
// The decoded `Image` for each manifest entry (filled by preloadArt), and the per-size texture cache.
// The images are DPR-independent; only the rasterised textures depend on the ratio, so a DPR change
// clears the texture cache but keeps the decoded SVG images.

const svgImages = new Map<string, HTMLImageElement>();
const textureCache = new Map<string, Texture>();

let currentDpr = liveDevicePixelRatio();

/** The DPR the loader rasterises for. */
export function artDpr(): number {
  return currentDpr;
}

/**
 * Re-aim the rasteriser at a new device pixel ratio. `screen.ts` already re-applies the ratio on a
 * display move / OS scale / browser zoom; main.ts calls this from the same signal so the art cache is
 * invalidated alongside the backing store. The decoded SVG images are kept — only the rasterised
 * textures are dropped, so the next draw re-rasterises crisp at the new density.
 */
export function setArtDpr(dpr: number): void {
  const next = Math.max(0.1, dpr || 1);
  if (next === currentDpr) return;
  currentDpr = next;
  textureCache.clear();
}

/** True once an asset's SVG has been decoded and is ready to rasterise. */
export function hasArt(name: string): boolean {
  return svgImages.has(name);
}

/**
 * The texture for an asset at a logical pixel size, or null when the asset is absent (not yet loaded,
 * missing, or malformed). Synchronous once the image is decoded: the raster draw happens here. Callers
 * fall back to their procedural drawing on null.
 */
export function getArtTexture(name: string, logicalPx: number): Texture | null {
  const image = svgImages.get(name);
  if (image === undefined) return null;
  if (typeof document === 'undefined') return null;

  const pixelSize = rasterPixelSize(logicalPx, currentDpr);
  const key = cacheKey(name, pixelSize);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, pixelSize, pixelSize);

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}

/** Clear the loader state (used by tests to re-run a preload). */
export function resetArt(): void {
  svgImages.clear();
  textureCache.clear();
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function preloadEntry(entry: ArtEntry): Promise<void> {
  const response = await fetch(artUrl(entry.file));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const svg = await response.text();
  if (typeof Image === 'undefined' || typeof document === 'undefined') return;
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  svgImages.set(entry.name, image);
}

/**
 * Preload every manifest entry: fetch the SVG text, decode it into an `Image`, and store it. A missing
 * or malformed file logs a warning and leaves the name absent, so `getArtTexture` returns null and the
 * caller's procedural fallback takes over. Run once at startup; the decode is the only async work, so
 * the per-frame draw stays synchronous.
 */
export async function preloadArt(): Promise<void> {
  const results = await Promise.allSettled(ART_MANIFEST.map(preloadEntry));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[art] failed to load ${ART_MANIFEST[i].file}: ${reason}`);
    }
  });
}
