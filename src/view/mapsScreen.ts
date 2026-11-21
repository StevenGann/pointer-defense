import { Container, Graphics, Sprite, Text, Texture, TextureSource } from 'pixi.js';
import { bevel, dottedLine, FONT, FONT_SIZE, PAL, type Layout, type Rect } from './chrome.ts';
import { t } from '../i18n/index.ts';
import { levelName } from '../i18n/names.ts';
import { isRtl } from './direction.ts';
import { COLS, ROWS } from '../core/grid.ts';
import { LEVELS, type Level } from '../core/levels.ts';
import { levelThumbnail, type ThumbCell } from '../core/thumb.ts';
import {
  mapGridMetrics,
  MAP_CARD_W,
  MAP_CARD_H,
  MAP_GRID_COLS,
  MAP_NAME_SIZE,
  MAP_HISTORY_SIZE,
} from './mapSelect.ts';

/**
 * The map-selection gallery (docs/MAP-SELECT.md): a three-column grid of cards inside the main client
 * area, drawn with the same raised bevel and focus ring the menu buttons use. Each card's thumbnail
 * is rasterised once per level at 6 px a cell and cached by level id, so the per-frame draw only
 * moves sprites and sets text — it never re-rasterises or allocates a new graphics object.
 *
 * Cards live in a masked layer clipped to the scrollable view; when the grid overflows, a sunken
 * scrollbar with a raised thumb is drawn on the client edge.
 */

const THUMB_CELL = 6;
const THUMB_W = COLS * THUMB_CELL;
const THUMB_H = ROWS * THUMB_CELL;
const CARD_PAD = 8;

const thumbTextures = new Map<string, Texture>();

/** A hex string for a PAL colour, for the thumbnail canvas. */
function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** A colour darkened by 8 % (each channel scaled by 0.92), for the no-build thumbnail tile. */
function darken8(color: number): number {
  const r = Math.round(((color >> 16) & 0xff) * 0.92);
  const g = Math.round(((color >> 8) & 0xff) * 0.92);
  const b = Math.round((color & 0xff) * 0.92);
  return (r << 16) | (g << 8) | b;
}

const NO_BUILD_FLOOR = darken8(PAL.face);

/** The fill colour for a thumbnail cell: the floor colour, darkened 8 % for a no-build tile. */
export function thumbBase(cell: ThumbCell): string {
  switch (cell) {
    case 'wall':
      return css(PAL.dark);
    case 'route':
      return css(PAL.shadow);
    case 'no-build':
      return css(NO_BUILD_FLOOR);
    case 'spawn':
    case 'exit':
      // The spawn and exit sit on the route; the marker colour is drawn over this mid tone.
      return css(PAL.shadow);
    default:
      return css(PAL.face);
  }
}

/** Rasterise a level's description once into a 120 x 72 texture, cached by level id. */
export function thumbnailTexture(level: Level): Texture {
  const cached = thumbTextures.get(level.id);
  if (cached) return cached;
  const tex = rasterizeThumb(level);
  thumbTextures.set(level.id, tex);
  return tex;
}

/** The number of levels whose thumbnail has been rasterised so far, for the smoke harness. */
export function thumbCacheSize(): number {
  return thumbTextures.size;
}

/** Rasterise one level's cell description. Headless (no canvas) it returns a blank texture of the
 *  right size so the cache still exercises its one-per-id contract without a renderer. */
function rasterizeThumb(level: Level): Texture {
  const cells = levelThumbnail(level);
  if (typeof document === 'undefined') return new Texture({ source: new TextureSource({ width: THUMB_W, height: THUMB_H }) });
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = cells[r * COLS + c];
        ctx.fillStyle = thumbBase(cell);
        ctx.fillRect(c * THUMB_CELL, r * THUMB_CELL, THUMB_CELL, THUMB_CELL);
        if (cell === 'spawn' || cell === 'exit') {
          ctx.fillStyle = css(cell === 'spawn' ? PAL.title : PAL.maroon);
          ctx.fillRect(c * THUMB_CELL + 1, r * THUMB_CELL + 1, THUMB_CELL - 2, THUMB_CELL - 2);
        }
      }
    }
  }
  return Texture.from(canvas);
}

function makeText(text: string, fill: number, bold = false, size: number = FONT_SIZE.body): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class MapsScreenView {
  readonly root = new Container();
  private readonly cardsLayer = new Container();
  private readonly cardGfx = new Graphics();
  private readonly scrollGfx = new Graphics();
  /** The clip mask over the cards layer, rebuilt only when the client rect changes. */
  private readonly mask = new Graphics();
  private readonly titleText: Text;
  private readonly thumbSprites: Sprite[] = [];
  private readonly nameTexts: Text[] = [];
  private readonly historyTexts: Text[] = [];
  /** Pre-allocated card positions, written each frame so a draw never allocates an array. */
  private readonly cardXs: number[] = new Array<number>(LEVELS.length);
  private readonly cardYs: number[] = new Array<number>(LEVELS.length);
  private maskKey = '';

  constructor() {
    this.titleText = makeText(t('shell.maps.title'), PAL.navy, true);
    this.titleText.anchor.set(0.5, 0.5);
    this.root.addChild(this.titleText);

    this.cardsLayer.addChild(this.cardGfx);
    for (let i = 0; i < LEVELS.length; i++) {
      const spr = new Sprite();
      this.thumbSprites.push(spr);
      this.cardsLayer.addChild(spr);
      const name = makeText('', PAL.text, true, MAP_NAME_SIZE);
      name.anchor.set(0.5, 0.5);
      this.nameTexts.push(name);
      this.cardsLayer.addChild(name);
      const history = makeText('', PAL.shadow, false, MAP_HISTORY_SIZE);
      history.anchor.set(0.5, 0.5);
      this.historyTexts.push(history);
      this.cardsLayer.addChild(history);
    }
    this.cardsLayer.mask = this.mask;
    this.root.addChild(this.cardsLayer, this.scrollGfx);
  }

  draw(l: Layout, focus: number, hover: number | null, best: ReadonlyMap<string, number>, scroll: number): void {
    const g = this.cardGfx;
    g.clear();
    this.scrollGfx.clear();

    this.titleText.text = t('shell.maps.title');
    this.titleText.position.set(l.client.x + Math.floor(l.client.w / 2), l.client.y + 14);

    const m = mapGridMetrics(l.client, LEVELS.length, scroll);

    const key = l.client.x + ',' + l.client.y + ',' + l.client.w + ',' + l.client.h;
    if (key !== this.maskKey) {
      this.maskKey = key;
      this.mask.clear();
      this.mask.rect(m.view.x, m.view.y, m.view.w, m.view.h).fill(0xffffff);
    }

    for (let i = 0; i < LEVELS.length; i++) {
      const col = i % MAP_GRID_COLS;
      const row = Math.floor(i / MAP_GRID_COLS);
      const visualCol = isRtl() ? MAP_GRID_COLS - 1 - col : col;
      this.cardXs[i] = m.ox + visualCol * m.colStep;
      this.cardYs[i] = m.oy + row * m.rowStep;
    }

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      const x = this.cardXs[i];
      const y = this.cardYs[i];
      const rect: Rect = { x, y, w: MAP_CARD_W, h: MAP_CARD_H };
      const hovered = hover === i;
      bevel(g, rect, true, hovered ? PAL.highlight : PAL.face);

      if (i === focus) {
        dottedLine(g, rect.x + 3, rect.y + 3, rect.x + rect.w - 3, rect.y + 3, PAL.dark);
        dottedLine(g, rect.x + rect.w - 3, rect.y + 3, rect.x + rect.w - 3, rect.y + rect.h - 3, PAL.dark);
        dottedLine(g, rect.x + rect.w - 3, rect.y + rect.h - 3, rect.x + 3, rect.y + rect.h - 3, PAL.dark);
        dottedLine(g, rect.x + 3, rect.y + rect.h - 3, rect.x + 3, rect.y + 3, PAL.dark);
      }

      const spr = this.thumbSprites[i];
      spr.texture = thumbnailTexture(level);
      spr.width = THUMB_W;
      spr.height = THUMB_H;
      spr.position.set(rect.x + Math.floor((rect.w - THUMB_W) / 2), rect.y + CARD_PAD);

      this.nameTexts[i].text = levelName(level.id);
      this.nameTexts[i].position.set(rect.x + Math.floor(rect.w / 2), rect.y + CARD_PAD + THUMB_H + 11);

      const wave = best.get(level.id);
      this.historyTexts[i].text = wave === undefined ? t('shell.maps.best.none') : t('shell.maps.best', { n: wave });
      this.historyTexts[i].position.set(rect.x + Math.floor(rect.w / 2), rect.y + CARD_PAD + THUMB_H + 27);
    }

    if (m.overflow) {
      bevel(this.scrollGfx, m.scrollbar, false, PAL.face);
      bevel(this.scrollGfx, m.thumb, true, PAL.face);
      const gy = m.thumb.y + Math.floor(m.thumb.h / 2) - 1;
      this.scrollGfx.rect(m.thumb.x + 2, gy, m.thumb.w - 4, 2).fill(PAL.shadow);
    }
  }
}
