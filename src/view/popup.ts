import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, type Rect } from './chrome.ts';
import { POPUP_SPECS, type Popup } from '../core/popups.ts';
import type { RunState } from '../core/state.ts';

/**
 * Draws the live desktop pop-up as a small Windows 95 dialog. The geometry (position, size) is
 * owned by the sim so the input layer and this view hit-test the same rect.
 */

export const POPUP_TITLE_H = 18;
const CLOSE_W = 11;
const CLOSE_H = 9;
const POPUP_APPEAR_TICKS = 6;

/** The close box, 11x9 in the top-right of the title bar. */
export function popupCloseRect(popup: Popup): Rect {
  return {
    x: popup.x + popup.w - CLOSE_W - 2,
    y: popup.y + Math.floor((POPUP_TITLE_H - CLOSE_H) / 2) + 2,
    w: CLOSE_W,
    h: CLOSE_H,
  };
}

function makeText(text: string): Text {
  return new Text({ text, style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text } });
}

export class PopupView {
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
    const popup = state.popup;
    if (!popup) {
      this.title.text = '';
      this.message.text = '';
      this.seenId = null;
      return;
    }
    if (popup.id !== this.seenId) {
      this.seenId = popup.id;
      this.bornTick = state.tick;
    }

    const spec = POPUP_SPECS[popup.kind];
    bevel(g, { x: popup.x, y: popup.y, w: popup.w, h: popup.h }, true, PAL.face);

    // Appear snap: a bright frame for the first 6 ticks, no easing (docs/design.md §13.4).
    const age = state.tick - this.bornTick;
    if (age < POPUP_APPEAR_TICKS) {
      const a = 1 - age / POPUP_APPEAR_TICKS;
      g.rect(popup.x, popup.y, popup.w, popup.h).stroke({ width: 2, color: PAL.highlight, alpha: a });
    }

    // Title bar (navy). The Blue Screen trap's only tell: the title text sits a pixel high.
    g.rect(popup.x + 2, popup.y + 2, popup.w - 4, POPUP_TITLE_H).fill(PAL.title);
    this.title.text = spec.title;
    this.title.style.fill = PAL.titleInverse;
    this.title.position.set(
      popup.x + 6,
      popup.y + 2 + Math.floor(POPUP_TITLE_H / 2) - (popup.kind === 'bluescreen' ? 1 : 0),
    );

    // Close box.
    const close = popupCloseRect(popup);
    bevel(g, close, true, PAL.face);
    const cx = close.x + Math.floor(close.w / 2);
    const cy = close.y + Math.floor(close.h / 2);
    g.moveTo(cx - 3, cy - 2).lineTo(cx + 3, cy + 2).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 3, cy - 2).lineTo(cx - 3, cy + 2).stroke({ width: 1, color: PAL.text });

    // Message line, centred in the body below the title bar.
    this.message.text = spec.message;
    this.message.style.fill = PAL.text;
    const bodyTop = popup.y + 2 + POPUP_TITLE_H;
    const bodyH = popup.h - POPUP_TITLE_H - 4;
    this.message.position.set(popup.x + 6, bodyTop + Math.floor(bodyH / 2));
  }
}
