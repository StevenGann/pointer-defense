import { Container, Graphics, Text } from 'pixi.js';
import { bevel, CONTROL_BOX_H, CONTROL_BOX_W, FONT, FONT_SIZE, PAL, TITLE_H, type Rect } from './chrome.ts';
import { AD_SPECS, type Ad } from '../core/ads.ts';
import type { RunState } from '../core/state.ts';
import { TRAY_LIFETIME_TICKS, type TrayPopup } from '../core/upgrades.ts';

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

/** The System Update pop-up is clickable anywhere in its frame (docs/GLOBAL-UPGRADES.md §5). */
export function trayHit(tray: TrayPopup, x: number, y: number): boolean {
  return x >= tray.x && x < tray.x + tray.w && y >= tray.y && y < tray.y + tray.h;
}

/**
 * System Tray's System Update pop-up: a 120x64 Windows 95 window in the field's top-right corner,
 * drawn with the same chrome as the desktop ads. The sim owns its rect so input and view agree.
 */
export class TrayView {
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
    const tray = state.tray;
    if (!tray) {
      this.title.text = '';
      this.message.text = '';
      this.seenId = null;
      return;
    }
    if (tray.id !== this.seenId) {
      this.seenId = tray.id;
      this.bornTick = state.tick;
    }
    const rect = { x: tray.x, y: tray.y, w: tray.w, h: tray.h };
    bevel(g, rect, true, PAL.face);
    const age = state.tick - this.bornTick;
    if (age < AD_APPEAR_TICKS) {
      g.rect(tray.x, tray.y, tray.w, tray.h).stroke({ width: 2, color: PAL.highlight, alpha: 1 - age / AD_APPEAR_TICKS });
    }
    g.rect(tray.x + 2, tray.y + 2, tray.w - 4, TITLE_H).fill(PAL.title);
    this.title.text = 'System Update';
    this.title.style.fill = PAL.titleInverse;
    this.title.position.set(tray.x + 6, tray.y + 2 + Math.floor(TITLE_H / 2));

    // The countdown to self-close, as a thin bar along the bottom of the body.
    const left = Math.max(0, tray.until - state.clock);
    const body = { x: tray.x + 6, y: tray.y + tray.h - 8, w: tray.w - 12, h: 3 };
    g.rect(body.x, body.y, body.w, body.h).fill(PAL.shadow);
    g.rect(body.x, body.y, Math.round((body.w * left) / TRAY_LIFETIME_TICKS), body.h).fill(PAL.title);

    this.message.text = 'Click to install';
    this.message.style.fill = PAL.text;
    const bodyTop = tray.y + 2 + TITLE_H;
    this.message.position.set(tray.x + 6, bodyTop + Math.floor((tray.h - TITLE_H - 12) / 2));
  }
}
