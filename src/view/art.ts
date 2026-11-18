import { Texture } from 'pixi.js';
import { baseEnemyKind, type EnemyKind } from '../core/enemies.ts';
import { liveDevicePixelRatio } from './screen.ts';
import type { AnimMeta } from './anim.ts';

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

export type ArtCategory = 'enemies' | 'towers' | 'branches' | 'board' | 'fx' | 'ui';

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

/** Effect sprites: fixed shapes whose only runtime variation is position/scale/rotation/alpha/tint. */
const FX_NAMES = [
  'muzzle-gun',
  'muzzle-cannon',
  'muzzle-frost',
  'muzzle-laser',
  'muzzle-taser',
  'spark-hit',
  'shield-arc',
  'death-ring',
] as const;

/** UI glyphs: fixed chrome marks. `arrow-right` is reserved (its mirror ships first). */
const UI_NAMES = [
  'cursor-arrow',
  'offline-wrench',
  'shutter-open',
  'shutter-closed',
  'check',
  'glyph-minimize',
  'glyph-maximize',
  'glyph-close',
  'arrow-left',
  'arrow-right',
] as const;

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
  ...entries('fx', 'fx', FX_NAMES),
  ...entries('ui', 'ui', UI_NAMES),
];

const MANIFEST_BY_NAME: ReadonlyMap<string, ArtEntry> = new Map(ART_MANIFEST.map((e) => [e.name, e]));

/** The manifest entry for an asset name, or undefined when the name is not in the manifest. */
export function manifestEntry(name: string): ArtEntry | undefined {
  return MANIFEST_BY_NAME.get(name);
}

/**
 * The asset name for an enemy kind, or null for kinds that stay runtime (the Pop-up). Boss variants
 * resolve to their base type's asset: they are drawn as the base silhouette at a larger scale, with
 * the boss motif added at runtime, so no new art files are needed yet.
 */
export function artNameForEnemy(kind: EnemyKind): string | null {
  const base = baseEnemyKind(kind);
  return (ENEMY_KINDS as readonly string[]).includes(base) ? base : null;
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

// --- Runtime manifest ---------------------------------------------------------------------------
// The runtime manifest is generated by `scripts/art-manifest.mjs` into `public/art/manifest.json`
// and fetched by `preloadArt`. It maps each asset path (e.g. "enemies/grunt") to its frame count and,
// for animated assets, its animation metadata. The hand-maintained `ART_MANIFEST` above is now only
// the fallback: if `manifest.json` is missing (a build that skipped the script), every asset is a
// one-frame still and nothing on screen changes.

/** One asset from the generated `public/art/manifest.json`. */
export interface ManifestAsset {
  /** Asset path relative to `public/art/`, no `.svg` — e.g. "enemies/grunt". */
  readonly name: string;
  /** Number of frames: 1 for a still, 2+ for an animation. */
  readonly frames: number;
  /** Animation metadata; present only for animated assets. */
  readonly anim?: AnimMeta;
}

/** The bare asset name (the part after the last `/`) used by every texture lookup. */
function bareName(assetName: string): string {
  return assetName.slice(assetName.lastIndexOf('/') + 1);
}

/** The runtime manifest, keyed by bare name ("grunt", not "enemies/grunt"). */
const manifestByName = new Map<string, ManifestAsset>();

/** Replace the runtime manifest. Seeded from the built-in list; `preloadArt` overwrites it. */
function applyManifest(assets: readonly ManifestAsset[]): void {
  manifestByName.clear();
  for (const asset of assets) manifestByName.set(bareName(asset.name), asset);
}

/** The built-in fallback manifest: every fixed asset as a one-frame still. */
function fallbackManifest(): ManifestAsset[] {
  return ART_MANIFEST.map((e) => ({ name: e.file.replace(/\.svg$/, ''), frames: 1 }));
}

applyManifest(fallbackManifest());

/** The animation metadata for an asset, or null when it is a still (or unknown). */
export function animationOf(name: string): AnimMeta | null {
  return manifestByName.get(name)?.anim ?? null;
}

// --- Loader state ------------------------------------------------------------------------------
// The decoded `Image` per frame for each asset (filled by preloadArt), and the per-size texture cache
// keyed by name@device-pixel-size. The images are DPR-independent; only the rasterised textures depend
// on the ratio, so a DPR change clears the frame cache but keeps the decoded SVG images.

const EMPTY_FRAMES: readonly Texture[] = [];

const svgFrames = new Map<string, HTMLImageElement[]>();
const frameCache = new Map<string, readonly Texture[]>();
// Test-only overrides: a name -> frame textures the smoke test injects to exercise the sprite path
// without a DOM. Empty in production, where the loader and rasteriser above are the only way in.
const injectedFrames = new Map<string, readonly Texture[]>();

let currentDpr = liveDevicePixelRatio();

/** The DPR the loader rasterises for. */
export function artDpr(): number {
  return currentDpr;
}

/**
 * Re-aim the rasteriser at a new device pixel ratio. `screen.ts` already re-applies the ratio on a
 * display move / OS scale / browser zoom; main.ts calls this from the same signal so the art cache is
 * invalidated alongside the backing store. The decoded SVG images are kept — only the rasterised
 * textures are dropped, so the next draw re-rasterises every frame crisp at the new density.
 */
export function setArtDpr(dpr: number): void {
  const next = Math.max(0.1, dpr || 1);
  if (next === currentDpr) return;
  currentDpr = next;
  frameCache.clear();
  scheduleArtInvalidate();
}

// --- Invalidation notifications -----------------------------------------------------------------
// Art loads async (preloadArt) and re-rasterises on a DPR change (setArtDpr); both leave the view's
// cached sprites and the static tile layer stale. Subscribers run once after each such event so the
// view can re-read the texture lookup. Several signals in the same tick are coalesced into one
// callback, so a completed preload and a ratio change never cause two redraws.

type ArtInvalidateListener = () => void;
const artInvalidateListeners = new Set<ArtInvalidateListener>();
let artInvalidateQueued = false;

/** Subscribe to art invalidation. Returns an unsubscribe function. */
export function onArtInvalidate(listener: ArtInvalidateListener): () => void {
  artInvalidateListeners.add(listener);
  return () => {
    artInvalidateListeners.delete(listener);
  };
}

function scheduleArtInvalidate(): void {
  if (artInvalidateQueued) return;
  artInvalidateQueued = true;
  queueMicrotask(() => {
    artInvalidateQueued = false;
    for (const listener of [...artInvalidateListeners]) listener();
  });
}

/** True once an asset's SVGs have been decoded and are ready to rasterise. */
export function hasArt(name: string): boolean {
  return svgFrames.has(name);
}

/**
 * The texture for an asset at a logical pixel size, or null when the asset is absent (not yet loaded,
 * missing, or malformed). Synchronous once the images are decoded: the raster draw happens here. A
 * still asset is a one-frame sequence, so this is frame 0 of `getArtFrames`.
 */
export function getArtTexture(name: string, logicalPx: number): Texture | null {
  return getArtFrames(name, logicalPx)[0] ?? null;
}

/**
 * The rasterised frame textures for an asset at a logical pixel size, in frame order (frame 0 first).
 * Cached per name and device-pixel size and cleared by `setArtDpr`, exactly like the single-texture
 * lookup it generalises. Returns an empty array when the asset is absent, so callers fall back to
 * their procedural drawing.
 */
export function getArtFrames(name: string, logicalPx: number): readonly Texture[] {
  const injected = injectedFrames.get(name);
  if (injected !== undefined) return injected;

  const images = svgFrames.get(name);
  if (images === undefined || images.length === 0) return EMPTY_FRAMES;
  if (typeof document === 'undefined') return EMPTY_FRAMES;

  const pixelSize = rasterPixelSize(logicalPx, currentDpr);
  const key = cacheKey(name, pixelSize);
  const cached = frameCache.get(key);
  if (cached) return cached;

  const frames = images.map((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, pixelSize, pixelSize);
    }
    return Texture.from(canvas);
  });
  frameCache.set(key, frames);
  return frames;
}

/** Test-only: force `getArtTexture(name)` to resolve to `texture` (frame 0) without the loader. */
export function injectArtTexture(name: string, texture: Texture): void {
  injectedFrames.set(name, [texture]);
}

/** Test-only: force `getArtFrames(name)` to resolve to `textures` in order. */
export function injectArtFrames(name: string, textures: readonly Texture[]): void {
  injectedFrames.set(name, textures);
}

/** Test-only: attach animation metadata to a name so the smoke test can exercise the animator. */
export function injectArtAnim(name: string, anim: AnimMeta): void {
  manifestByName.set(name, { name, frames: 1, anim });
}

/** Test-only: seed a raster cache entry so the smoke test can assert a DPR change drops it. */
export function seedFrameCache(name: string, pixelSize: number, textures: readonly Texture[]): void {
  frameCache.set(cacheKey(name, pixelSize), textures);
}

/** Test-only: the number of cached frame arrays (a DPR change must return this to zero). */
export function cachedFrameCount(): number {
  return frameCache.size;
}

/** Clear the loader state (used by tests to re-run a preload). */
export function resetArt(): void {
  svgFrames.clear();
  frameCache.clear();
  injectedFrames.clear();
  applyManifest(fallbackManifest());
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function decodeSvg(file: string): Promise<HTMLImageElement> {
  const response = await fetch(artUrl(file));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const svg = await response.text();
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  return image;
}

async function preloadAsset(asset: ManifestAsset): Promise<void> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return;
  const count = Math.max(1, Math.floor(asset.frames));
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    files.push(i === 0 ? `${asset.name}.svg` : `${asset.name}.${i}.svg`);
  }
  const images = await Promise.all(files.map(decodeSvg));
  svgFrames.set(bareName(asset.name), images);
}

async function loadManifestAssets(): Promise<ManifestAsset[]> {
  try {
    const response = await fetch(artUrl('manifest.json'));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json: unknown = await response.json();
    if (json !== null && typeof json === 'object' && Array.isArray((json as { assets?: unknown }).assets)) {
      return (json as { assets: ManifestAsset[] }).assets;
    }
    throw new Error('malformed manifest.json');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[art] manifest.json unavailable, using the built-in list (${reason})`);
    return fallbackManifest();
  }
}

/**
 * Load the runtime manifest, then preload every frame of every asset: fetch each SVG, decode it into
 * an `Image`, and store the per-asset frame list. A missing or malformed file logs a warning and
 * leaves the name absent, so `getArtFrames` returns an empty list and the caller's procedural
 * fallback takes over. Run once at startup; the decode is the only async work, so the per-frame draw
 * stays synchronous.
 */
export async function preloadArt(): Promise<void> {
  const assets = await loadManifestAssets();
  applyManifest(assets);
  const results = await Promise.allSettled(assets.map(preloadAsset));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.warn(`[art] failed to load ${assets[i].name}: ${reason}`);
    }
  });
  scheduleArtInvalidate();
}
