import { Texture } from 'pixi.js';
import { baseEnemyKind, type EnemyKind } from '../core/enemies.ts';
import { ACHIEVEMENTS } from '../core/achievements.ts';
import { GLOBAL_UPGRADES } from '../core/upgrades.ts';
import { liveDevicePixelRatio } from './screen.ts';
import { currentAnimFrame, lifetimeFrame, secondsToWholeTicks, type AnimMeta } from './anim.ts';

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

export type ArtCategory =
  | 'enemies'
  | 'towers'
  | 'branches'
  | 'board'
  | 'fx'
  | 'ui'
  | 'wall'
  | 'achievements'
  | 'upgrades'
  | 'projectiles'
  | 'mines';

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

/**
 * Every enemy asset name. The boss variants are listed separately: each owns a file of its own
 * (`grunt-boss.svg`) so the artist can add details the base type does not have. The shipped boss files
 * are copies of their base type, so they render exactly as before until someone edits them.
 */
const ENEMY_KINDS = [
  'grunt', 'runner', 'shielded', 'flyer', 'armoured', 'saboteur', 'breacher',
  'grunt-boss', 'runner-boss', 'shielded-boss', 'flyer-boss', 'armoured-boss', 'saboteur-boss', 'breacher-boss',
] as const;

/** Towers ship a base plinth (never rotates) and, for those with a barrel, a turret (rotates). */
const TOWER_BASE_KINDS = ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa', 'beacon', 'cursor', 'repair'] as const;
const TOWER_TURRET_KINDS = ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa'] as const;

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

/** Achievement icons: one file per id, plus the `_placeholder` every missing file falls back to. */
const ACHIEVEMENT_NAMES = ['_placeholder', ...ACHIEVEMENTS.map((a) => a.id)] as const;

/** The global-upgrade placeholder (`upgrades/_upgrade-placeholder.svg`), keyed by its bare name. */
export const UPGRADE_PLACEHOLDER = '_upgrade-placeholder';

/** Global-upgrade icons (docs/GLOBAL-UPGRADES.md §7): one 44x44 file per id. */
const UPGRADE_NAMES = GLOBAL_UPGRADES.map((u) => u.id);

/** Effect sprites: fixed shapes whose only runtime variation is position/scale/rotation/alpha/tint. */
const FX_NAMES = [
  // One fire effect per tower kind, plus one per branch — a Marksman should not flash like a Repeater.
  'muzzle-gun',
  'muzzle-cannon',
  'muzzle-frost',
  'muzzle-laser',
  'muzzle-taser',
  'muzzle-aa',
  'muzzle-cursor',
  'muzzle-gun-marksman',
  'muzzle-gun-repeater',
  'muzzle-cannon-mortar',
  'muzzle-cannon-minesweeper',
  'muzzle-laser-focus',
  'muzzle-laser-prism',
  'muzzle-taser-arc',
  'muzzle-taser-overload',
  'muzzle-frost-deep-freeze',
  'muzzle-frost-shard',
  'muzzle-aa-flak',
  'muzzle-aa-missile',
  'muzzle-cursor-overclock',
  'muzzle-cursor-wide-search',
  'muzzle-cursor-maintenance',
  'spark-hit',
  'shield-arc',
  'death-ring',
  'aura-heal',
  'aura-beacon',
  'aura-override',
  'aura-emp',
] as const;

/** UI glyphs: fixed chrome marks. `arrow-right` is reserved (its mirror ships first). */
const UI_NAMES = [
  'cursor-arrow',
  'cursor-help',
  'offline-wrench',
  'shutter-open',
  'shutter-closed',
  'check',
  'glyph-minimize',
  'glyph-maximize',
  'glyph-close',
  'glyph-help',
  'arrow-left',
  'arrow-right',
] as const;

/**
 * The wall's button faces and overlays. A wall draws one tier face (`wall-t1`..`wall-t5`, tinted to
 * its live grey) plus any overlays its state adds: the Bulwark inner rim, the Mesh crosshatch, the
 * repair hatch, and a damage stage. The bevel and outline stay procedural (see `board.ts`).
 */
const WALL_NAMES = [
  'wall-t1',
  'wall-t2',
  'wall-t3',
  'wall-t4',
  'wall-t5',
  'wall-bulwark',
  'wall-mesh',
  'wall-repairing',
  'wall-damaged-1',
  'wall-damaged-2',
  'wall-damaged-3',
] as const;

/** In-flight ordnance. One file per `ProjectileKind`, rotated to its heading by the renderer. */
const PROJECTILE_NAMES = ['shell', 'missile'] as const;

/** Mines, split by arming state so the lamp can change without tinting the file. */
const MINE_NAMES = ['mine-armed', 'mine-unarmed'] as const;

/** Synergy indicators (docs/SYNERGIES.md): white art, tinted by the engine to the synergy colour. */
const SYNERGY_NAMES = ['synergy-halo', 'synergy-link', 'synergy-link-spotter'] as const;

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
  ...entries('wall', 'wall', WALL_NAMES),
  ...entries('achievements', 'achievements', ACHIEVEMENT_NAMES),
  ...entries('upgrades', 'upgrades', [UPGRADE_PLACEHOLDER, ...UPGRADE_NAMES]),
  ...entries('projectiles', 'projectiles', PROJECTILE_NAMES),
  ...entries('mines', 'mines', MINE_NAMES),
  ...entries('ui', 'ui', SYNERGY_NAMES),
];

const MANIFEST_BY_NAME: ReadonlyMap<string, ArtEntry> = new Map(ART_MANIFEST.map((e) => [e.name, e]));

/** The manifest entry for an asset name, or undefined when the name is not in the manifest. */
export function manifestEntry(name: string): ArtEntry | undefined {
  return MANIFEST_BY_NAME.get(name);
}

/**
 * The asset name for an enemy kind, or null for kinds that stay runtime (the Pop-up).
 *
 * A boss variant owns its own asset (`grunt-boss`), so the artist can give each boss details its base
 * type does not have. The shipped boss files are copies of their base type — placeholders that render
 * exactly as before until the artist edits them.
 */
export function artNameForEnemy(kind: EnemyKind): string | null {
  return (ENEMY_KINDS as readonly string[]).includes(kind) ? kind : null;
}

/**
 * The art names to try for an enemy, most specific first. A boss resolves its own asset and falls back
 * to its base type's, so deleting a boss file degrades to the old shared art instead of dropping the
 * body to the procedural shape.
 */
export function enemyArtNames(kind: EnemyKind): readonly string[] {
  const own = artNameForEnemy(kind);
  const base = artNameForEnemy(baseEnemyKind(kind));
  return own !== null && base !== null && own !== base ? [own, base] : own !== null ? [own] : [];
}

/** The plinth asset for a tower kind (`<kind>-base`), or null when the kind ships no plinth (the Wall). */
export function artNameForTowerBase(kind: string): string | null {
  return (TOWER_BASE_KINDS as readonly string[]).includes(kind) ? `${kind}-base` : null;
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

/** An asset file URL carrying its content hash, so a replaced file is never served from cache. */
export function artFileUrl(file: string, rev?: string): string {
  const url = artUrl(file);
  return rev ? `${url}?v=${rev}` : url;
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
  /**
   * A short content hash of the asset's files, used as a cache-busting query. Art keeps its name
   * when the artist replaces it, and the CDN serves `/art/**` with a four-hour `max-age`, so without
   * a version a returning player keeps their first copy of an icon for the rest of the day.
   */
  readonly rev?: string;
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
  if (images === undefined || images.length === 0) {
    // A miss is also a request (docs/ART-LOADING.md): the caller draws its fallback this frame and
    // picks up the art on the invalidation that follows the load. Known names return at a Map lookup.
    requestArt(name, 'now');
    return EMPTY_FRAMES;
  }
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

/**
 * The one animated-texture resolution path: `getArtFrames` + `currentAnimFrame` in a single call.
 * A still (one frame) returns frame 0 unchanged; an absent asset returns null so the caller falls
 * back to its procedural drawing. `clockTicks` is the consumer's own clock (e.g. `now - spawnTick`
 * for an enemy, `now - placedTick` for a tower), `phaseSeed` is the per-entity offset that spreads
 * a crowd's `randomStart` phases, and `moving` gates the `when: "moving"` pose (enemies only).
 */
export function frameTexture(
  name: string,
  px: number,
  clockTicks: number,
  phaseSeed: number,
  moving = true,
): Texture | null {
  const frames = getArtFrames(name, px);
  if (frames.length === 0) return null;
  if (frames.length === 1) return frames[0];
  const anim = animationOf(name);
  const index = anim !== null ? currentAnimFrame(anim, frames.length, clockTicks, phaseSeed, moving) : 0;
  return frames[index] ?? null;
}

/**
 * The first texture found among `names`, tried in order. Used where one kind may ship its own art and
 * borrow another's when it does not: a boss with no file of its own still draws its base type.
 */
export function frameTextureFor(
  names: readonly string[],
  px: number,
  clockTicks: number,
  phaseSeed: number,
  moving = true,
): Texture | null {
  for (const name of names) {
    const tex = frameTexture(name, px, clockTicks, phaseSeed, moving);
    if (tex !== null) return tex;
  }
  return null;
}

/**
 * The lifetime clock model for effects: the sequence is spread across the effect's fixed life rather
 * than played at `fps` (a muzzle flash outlives several fps frames). `age` is ticks since the effect
 * spawned and `lifetime` its total life. `loop` and `randomStart` are ignored; `hold` is honoured
 * only as a delay before the first frame.
 */
export function effectFrameTexture(name: string, px: number, age: number, lifetime: number): Texture | null {
  const frames = getArtFrames(name, px);
  if (frames.length === 0) return null;
  if (frames.length === 1) return frames[0];
  const anim = animationOf(name);
  const index = anim !== null ? lifetimeFrame(frames.length, age, lifetime, secondsToWholeTicks(anim.hold)) : 0;
  return frames[index] ?? null;
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
  resetQueue();
}

// --- Loader: a priority queue (docs/ART-LOADING.md) ---------------------------------------------
// Nothing is fetched speculatively at startup except the art the opening frame can show (the eager
// set). Everything else is either asked for by a draw (`getArtFrames` on a miss queues it at `now`)
// or warmed up during idle time, one asset per idle slice. Draws stay synchronous: a miss returns
// the empty list, the caller keeps its procedural fallback, and the completed load fires
// `scheduleArtInvalidate()` so the art appears on the next redraw.

/**
 * How many art files are fetched at once. The assets are tiny, but ~220 simultaneous requests is
 * more than the browser or the CDN will carry: in a real load 188 of 217 came back as failed
 * fetches. Six at a time matches the per-host connection limit.
 */
export const PRELOAD_CONCURRENCY = 6;

/** The art the opening frame can show. `preloadArt()` resolves once these have settled. */
export const EAGER_ART: readonly string[] = [
  'tile',
  'path-tile',
  'obstacle',
  'block',
  'cursor-arrow',
  'offline-wrench',
  'shutter-open',
  'shutter-closed',
];

/** `now`: something on screen asked for it this frame. `idle`: speculative warm-up. */
export type ArtPriority = 'now' | 'idle';

/** Counters since page start (or since the last `resetArt`). Times are `performance.now()` ms. */
export interface ArtLoadStats {
  /** Distinct assets that have entered the queue. */
  readonly requested: number;
  readonly loaded: number;
  /** Assets that failed twice and were left absent. */
  readonly failed: number;
  /** When the first asset finished loading, or null before any has. */
  readonly firstMs: number | null;
  /** When the most recent asset finished loading, or null before any has. */
  readonly lastMs: number | null;
}

/**
 * How assets reach the loader. Production uses `fetch` + `Image.decode`; the smoke test swaps in a
 * fake so the queue can be driven without a DOM or a network.
 */
export interface ArtTransport {
  /** The runtime manifest's asset list. */
  manifest(): Promise<ManifestAsset[]>;
  /** Every frame of one asset, decoded and ready to rasterise. Rejects on any failure. */
  load(asset: ManifestAsset): Promise<HTMLImageElement[]>;
}

/** The slice of `IdleDeadline` the queue reads. */
export interface ArtIdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

/** Schedules one idle callback and returns a function that cancels it. */
export type ArtIdleScheduler = (callback: (deadline: ArtIdleDeadline) => void) => () => void;

/** The idle fallback delay where `requestIdleCallback` is unavailable (Safari). */
const IDLE_FALLBACK_MS = 200;
/** How long an idle slice waits on `requestIdleCallback` before a timer runs it anyway. */
export const IDLE_STARVED_MS = 400;

interface QueuedAsset {
  priority: ArtPriority;
  status: 'queued' | 'loading' | 'loaded' | 'failed';
  attempts: number;
  /** The lane the current attempt runs in, so promotion mid-flight does not skew the counters. */
  lane: ArtPriority;
}

/** Every name the queue has seen. The `getArtFrames` miss path is one lookup here and an early return. */
const queued = new Map<string, QueuedAsset>();
const nowQueue: string[] = [];
const idleQueue: string[] = [];
let inFlight = 0;
let nowInFlight = 0;
let idleInFlight = 0;
/**
 * True until `preloadArt` has the runtime manifest. Requests made before then (a draw that runs ahead
 * of startup) are queued but not started, so no file is fetched without its content hash.
 */
let manifestPending = true;
/** Bumped by `resetArt`, so a load that settles after a reset is ignored. */
let generation = 0;
let cancelIdle: (() => void) | null = null;
const settleWaiters = new Map<string, Array<() => void>>();

let statRequested = 0;
let statLoaded = 0;
let statFailed = 0;
let statFirstMs: number | null = null;
let statLastMs: number | null = null;

let testTransport: ArtTransport | null = null;
let testIdleScheduler: ArtIdleScheduler | null = null;

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function decodeSvg(file: string, rev?: string): Promise<HTMLImageElement> {
  const response = await fetch(artFileUrl(file, rev));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const svg = await response.text();
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  return image;
}

async function loadAssetFrames(asset: ManifestAsset): Promise<HTMLImageElement[]> {
  const count = Math.max(1, Math.floor(asset.frames));
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    files.push(i === 0 ? `${asset.name}.svg` : `${asset.name}.${i}.svg`);
  }
  return Promise.all(files.map((file) => decodeSvg(file, asset.rev)));
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

/** The asset loader in use, or null where nothing can be decoded (headless, no test transport). */
function activeLoader(): ((asset: ManifestAsset) => Promise<HTMLImageElement[]>) | null {
  if (testTransport !== null) return testTransport.load;
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null;
  return loadAssetFrames;
}

function activeManifestSource(): () => Promise<ManifestAsset[]> {
  return testTransport !== null ? testTransport.manifest : loadManifestAssets;
}

/**
 * A busy 60fps frame loop can starve `requestIdleCallback` indefinitely, so a fallback timer is armed
 * alongside it. Whichever fires first runs the slice and cancels the other.
 */
const defaultIdleScheduler: ArtIdleScheduler = (callback) => {
  if (typeof requestIdleCallback === 'function') {
    let done = false;
    const idleHandle = requestIdleCallback((deadline) => {
      if (done) return;
      done = true;
      clearTimeout(timerHandle);
      callback(deadline);
    });
    const timerHandle = setTimeout(() => {
      if (done) return;
      done = true;
      cancelIdleCallback(idleHandle);
      callback({ didTimeout: true, timeRemaining: () => 0 });
    }, IDLE_STARVED_MS);
    return () => {
      done = true;
      cancelIdleCallback(idleHandle);
      clearTimeout(timerHandle);
    };
  }
  const handle = setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), IDLE_FALLBACK_MS);
  return () => clearTimeout(handle);
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Ask for an asset. A no-op when it is already loaded, in flight, failed for good, or queued at the
 * same or a higher priority. A `now` request for an asset sitting in the idle queue moves it to the
 * `now` queue (still one entry), which is how a draw preempts the warm-up. Names outside the manifest
 * are ignored, so a speculative lookup (a boss with no art of its own) costs nothing.
 */
export function requestArt(name: string, priority: ArtPriority): void {
  const entry = queued.get(name);
  if (entry !== undefined) {
    if (entry.status !== 'queued' || entry.priority === 'now' || priority === 'idle') return;
    // Promote: idle -> now.
    const at = idleQueue.indexOf(name);
    if (at >= 0) idleQueue.splice(at, 1);
    entry.priority = 'now';
    nowQueue.push(name);
    pump();
    return;
  }
  if (svgFrames.has(name) || !manifestByName.has(name)) return;
  queued.set(name, { priority, status: 'queued', attempts: 0, lane: priority });
  statRequested++;
  (priority === 'now' ? nowQueue : idleQueue).push(name);
  pump();
}

/** Assets still queued or in flight. */
export function artQueueLength(): number {
  return nowQueue.length + idleQueue.length + inFlight;
}

/** Load counters since page start. Cheap: no per-asset timers. */
export function artLoadStats(): ArtLoadStats {
  return { requested: statRequested, loaded: statLoaded, failed: statFailed, firstMs: statFirstMs, lastMs: statLastMs };
}

/** Test-only: drive the loader through a fake transport. `null` restores fetch + decode. */
export function setArtTransport(transport: ArtTransport | null): void {
  testTransport = transport;
}

/** Test-only: replace the idle scheduler. `null` restores requestIdleCallback / setTimeout. */
export function setArtIdleScheduler(scheduler: ArtIdleScheduler | null): void {
  if (cancelIdle !== null) {
    cancelIdle();
    cancelIdle = null;
  }
  testIdleScheduler = scheduler;
  pump();
}

/** Start every `now` request the network lanes allow, then arm an idle slice if nothing urgent is left. */
function pump(): void {
  if (manifestPending) return;
  const load = activeLoader();
  if (load === null) return;
  while (inFlight < PRELOAD_CONCURRENCY && nowQueue.length > 0) {
    startLoad(nowQueue.shift() as string, load);
  }
  scheduleIdle();
}

function scheduleIdle(): void {
  if (cancelIdle !== null || idleQueue.length === 0) return;
  if (nowQueue.length > 0 || nowInFlight > 0 || idleInFlight > 0) return;
  const scheduler = testIdleScheduler ?? defaultIdleScheduler;
  const gen = generation;
  cancelIdle = scheduler((deadline) => {
    if (gen !== generation) return;
    cancelIdle = null;
    runIdleSlice(deadline);
  });
}

/** One idle slice: start at most one asset, and only when no `now` work is outstanding. */
function runIdleSlice(deadline: ArtIdleDeadline): void {
  if (manifestPending) return;
  const load = activeLoader();
  if (load === null) return;
  // Urgent work or a running idle asset will call pump() when it settles, which re-arms the slice.
  if (nowQueue.length > 0 || nowInFlight > 0 || idleInFlight > 0) return;
  if (inFlight >= PRELOAD_CONCURRENCY) return;
  if (!deadline.didTimeout && deadline.timeRemaining() <= 0) {
    scheduleIdle();
    return;
  }
  const name = idleQueue.shift();
  if (name !== undefined) startLoad(name, load);
}

function startLoad(name: string, load: (asset: ManifestAsset) => Promise<HTMLImageElement[]>): void {
  const entry = queued.get(name);
  if (entry === undefined) return;
  const asset = manifestByName.get(name);
  if (asset === undefined) {
    // Dropped by a manifest swap while it waited: forget it, so a later request can try again.
    queued.delete(name);
    statRequested--;
    settle(name);
    return;
  }
  entry.status = 'loading';
  entry.attempts++;
  entry.lane = entry.priority;
  inFlight++;
  if (entry.lane === 'now') nowInFlight++;
  else idleInFlight++;
  const gen = generation;
  let pending: Promise<HTMLImageElement[]>;
  try {
    pending = load(asset);
  } catch (err) {
    pending = Promise.reject(err);
  }
  pending.then(
    (images) => finishLoad(gen, name, asset, images),
    () => finishLoad(gen, name, asset, null),
  );
}

function finishLoad(gen: number, name: string, asset: ManifestAsset, images: HTMLImageElement[] | null): void {
  if (gen !== generation) return;
  const entry = queued.get(name);
  if (entry === undefined) return;
  inFlight--;
  if (entry.lane === 'now') nowInFlight--;
  else idleInFlight--;

  if (images !== null) {
    svgFrames.set(name, images);
    entry.status = 'loaded';
    statLoaded++;
    const t = nowMs();
    if (statFirstMs === null) statFirstMs = t;
    statLastMs = t;
    scheduleArtInvalidate();
    settle(name);
  } else if (entry.attempts < 2) {
    // One retry. A burst of requests can have a few connections dropped by the browser or the CDN,
    // and a dropped asset keeps its procedural fallback for the whole session — which is how the
    // achievement grid came to show a wall of placeholders over art that was sitting on disk.
    entry.status = 'queued';
    (entry.priority === 'now' ? nowQueue : idleQueue).push(name);
  } else {
    entry.status = 'failed';
    statFailed++;
    console.warn(`[art] failed to load ${asset.name}`);
    settle(name);
  }
  pump();
}

function settle(name: string): void {
  const waiters = settleWaiters.get(name);
  if (waiters === undefined) return;
  settleWaiters.delete(name);
  for (const resolve of waiters) resolve();
}

/** Resolves once `name` has loaded, failed for good, or left the queue. */
function whenSettled(name: string): Promise<void> {
  const entry = queued.get(name);
  if (entry === undefined || entry.status === 'loaded' || entry.status === 'failed') return Promise.resolve();
  return new Promise((resolve) => {
    const list = settleWaiters.get(name);
    if (list) list.push(resolve);
    else settleWaiters.set(name, [resolve]);
  });
}

/** Drop the queue, its counters, and any armed idle slice (part of `resetArt`). */
function resetQueue(): void {
  generation++;
  if (cancelIdle !== null) {
    cancelIdle();
    cancelIdle = null;
  }
  queued.clear();
  nowQueue.length = 0;
  idleQueue.length = 0;
  inFlight = 0;
  nowInFlight = 0;
  idleInFlight = 0;
  manifestPending = true;
  statRequested = 0;
  statLoaded = 0;
  statFailed = 0;
  statFirstMs = null;
  statLastMs = null;
  const waiters = [...settleWaiters.values()].flat();
  settleWaiters.clear();
  for (const resolve of waiters) resolve();
}

/**
 * Load the runtime manifest, then the eager set — the art the opening frame can show — at `now`
 * priority, and resolve once those have settled. The rest of the manifest goes on the idle queue and
 * loads one asset per idle slice, unless a draw asks for it first. A missing or malformed file is
 * retried once, then logs a warning and stays absent, so `getArtFrames` returns an empty list and the
 * caller's procedural fallback takes over.
 */
export async function preloadArt(): Promise<void> {
  const gen = generation;
  const assets = await activeManifestSource()();
  if (gen !== generation) return;
  applyManifest(assets);
  manifestPending = false;
  for (const name of EAGER_ART) requestArt(name, 'now');
  for (const asset of assets) requestArt(bareName(asset.name), 'idle');
  // Draws that missed while manifest.json was in flight are queued already; start them now.
  pump();
  if (activeLoader() === null) return;
  await Promise.all(EAGER_ART.map(whenSettled));
}
