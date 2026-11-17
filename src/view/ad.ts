import { Container, Graphics, Text } from 'pixi.js';
import { bevel, CONTROL_BOX_H, CONTROL_BOX_W, FONT, FONT_SIZE, PAL, TITLE_H, type Rect } from './chrome.ts';
import { AD_SPECS, type Ad } from '../core/ads.ts';
import type { RunState } from '../core/state.ts';

/**
 * Draws the live desktop ad as a Windows 95 dialog at the main window's own scale: the title bar
 * is 22 px, the close box is 16x14, the border is a 2 px bevel and the text is 13 px. The geometry
 * (position, size) is owned by the sim so the input layer and this view hit-test the same rect.
 */

const AD_APPEAR_TICKS = 6;

/** The close box, 16x14 in the top-right of the 22 px title bar. */
export function adCloseRect(ad: Ad): Rect {
  return {
    x: ad.x + ad.w - 2 - CONTROL_BOX_W,
    y: ad.y + 2 + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };
}

function makeText(text: string): Text {
  return new Text({ text, style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text } });
}

export class AdView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title = makeText('');
  private readonly message = makeText('');
  private seenId: number | null = null;
  private bornTick = 0;

  constructor() {
    this.root.addChild(this.g);
    this.title.anchor.set(0, 0.5);
    this.title.style.fontWeight = 'bold';
    this.message.anchor.set(0, 0.5);
    this.root.addChild(this.title, this.message);
  }

  draw(state: RunState): void {
    const g = this.g;
    g.clear();
    const ad = state.ad;
    if (!ad) {
      this.title.text = '';
      this.message.text = '';
      this.seenId = null;
      return;
    }
    if (ad.id !== this.seenId) {
      this.seenId = ad.id;
      this.bornTick = state.tick;
    }

    const spec = AD_SPECS[ad.kind];
    bevel(g, { x: ad.x, y: ad.y, w: ad.w, h: ad.h }, true, PAL.face);

    // Appear snap: a bright frame for the first 6 ticks, no easing (docs/design.md §13.4).
    const age = state.tick - this.bornTick;
    if (age < AD_APPEAR_TICKS) {
      const a = 1 - age / AD_APPEAR_TICKS;
      g.rect(ad.x, ad.y, ad.w, ad.h).stroke({ width: 2, color: PAL.highlight, alpha: a });
    }

    // Title bar (navy), the same 22 px as the main window. The Blue Screen trap's only tell: the
    // title text sits a pixel high.
    g.rect(ad.x + 2, ad.y + 2, ad.w - 4, TITLE_H).fill(PAL.title);
    this.title.text = spec.title;
    this.title.style.fill = PAL.titleInverse;
    this.title.position.set(
      ad.x + 6,
      ad.y + 2 + Math.floor(TITLE_H / 2) - (ad.kind === 'bluescreen' ? 1 : 0),
    );

    // Close box, the same 16x14 full-size control as the main window's title bar.
    const close = adCloseRect(ad);
    bevel(g, close, true, PAL.face);
    const cx = close.x + Math.floor(close.w / 2);
    const cy = close.y + Math.floor(close.h / 2);
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });

    // Message line, centred in the body below the title bar.
    this.message.text = spec.message;
    this.message.style.fill = PAL.text;
    const bodyTop = ad.y + 2 + TITLE_H;
    const bodyH = ad.h - TITLE_H - 4;
    this.message.position.set(ad.x + 6, bodyTop + Math.floor(bodyH / 2));
  }
}
