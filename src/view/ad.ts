import { Container, Graphics, Text } from 'pixi.js';
import { bevel, CONTROL_BOX_H, CONTROL_BOX_W, FONT, FONT_SIZE, PAL, TITLE_H, type Rect } from './chrome.ts';
import { t } from '../i18n/index.ts';
import { textWidth } from './metrics.ts';
import {
  AD_AUTOUPDATE_DAMAGE_MULT,
  AD_DEFRAG_SALVAGE_PCT,
  AD_LIFETIME_TICKS,
  AD_SCREENSAVER_DAMAGE,
  AD_TIMEZONE_SPEED_MULT,
  type Ad,
  type AdKind,
} from '../core/ads.ts';
import type { RunState } from '../core/state.ts';
import { TRAY_LIFETIME_TICKS, type TrayPopup } from '../core/upgrades.ts';
import { isRtl } from './direction.ts';

/**
 * Draws the live desktop ad as a Windows 95 dialog at the main window's own scale: the title bar
 * is 22 px, the close box is 16x14, the border is a 2 px bevel and the text is 13 px. The geometry
 * (position, size) is owned by the sim so the input layer and this view hit-test the same rect.
 */

const AD_APPEAR_TICKS = 6;

/** The reward line's vertical centre sits 19 px below the title bar — the same place it did before
 *  the tip block was added, so the reason to click never moves (docs/ADS-TIPS.md §2.1). */
const REWARD_LINE_OFFSET = 19;

/** The tip block's horizontal padding and 11 px line height. */
const TIP_PAD = 6;
const TIP_LINE_H = 12;
const TIP_MAX_LINES = 3;

/**
 * Wrap a tip into lines that each fit `maxWidth` at the tip's 11 px, measured with `textWidth` so the
 * headless smoke harness and the browser agree on where a line breaks.
 */
export function wrapAdTip(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    if (lines.length === 0) {
      lines.push(word);
    } else {
      const candidate = lines[lines.length - 1] + ' ' + word;
      if (textWidth(candidate, FONT_SIZE.small) <= maxWidth) lines[lines.length - 1] = candidate;
      else lines.push(word);
    }
    // A single token wider than the box (CJK has no spaces) breaks by character.
    while (textWidth(lines[lines.length - 1], FONT_SIZE.small) > maxWidth) {
      const line = lines[lines.length - 1];
      let cut = line.length - 1;
      while (cut > 0 && textWidth(line.slice(0, cut), FONT_SIZE.small) > maxWidth) cut--;
      if (cut <= 0) cut = 1;
      lines[lines.length - 1] = line.slice(0, cut);
      lines.push(line.slice(cut));
    }
  }
  return lines;
}

/** The tip's wrapped display lines, shortened (never the box) if a locale would need a fourth line. */
function adTipLines(text: string, maxWidth: number): string[] {
  const lines = wrapAdTip(text, maxWidth);
  if (lines.length <= TIP_MAX_LINES) return lines;
  const words = text.split(' ');
  for (let n = words.length; n > 0; n--) {
    const candidate = words.slice(0, n).join(' ') + '…';
    const shortened = wrapAdTip(candidate, maxWidth);
    if (shortened.length <= TIP_MAX_LINES) return shortened;
  }
  return ['…'];
}

/** The title for a kind, from the catalogue. */
function adTitle(kind: AdKind): string {
  return t(`ads.kind.${kind}.title`);
}

/** The reward line, with its numbers computed from the same effect constants the sim reads. */
function adMessage(kind: AdKind): string {
  switch (kind) {
    case 'defrag':
      return t('ads.kind.defrag.message', { pct: Math.round(AD_DEFRAG_SALVAGE_PCT * 100) });
    case 'autoupdate':
      return t('ads.kind.autoupdate.message', { pct: Math.round((AD_AUTOUPDATE_DAMAGE_MULT - 1) * 100) });
    case 'timezone':
      return t('ads.kind.timezone.message', { pct: Math.round((1 - AD_TIMEZONE_SPEED_MULT) * 100) });
    case 'screensaver':
      return t('ads.kind.screensaver.message', { damage: AD_SCREENSAVER_DAMAGE });
    default:
      return t(`ads.kind.${kind}.message`);
  }
}

/** The reward line's vertical centre, for the layout tests to pin the unchanged position. */
export function adRewardLineY(ad: Ad): number {
  return ad.y + 2 + TITLE_H + REWARD_LINE_OFFSET;
}

/** The tip block's text-width budget: the box minus its 6 px side padding. */
export function adTipMaxWidth(ad: Ad): number {
  return ad.w - TIP_PAD * 2;
}

/** The close box, 16x14 in the top-right of the 22 px title bar. */
export function adCloseRect(ad: Ad): Rect {
  return {
    x: ad.x + ad.w - 2 - CONTROL_BOX_W,
    y: ad.y + 2 + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };
}

/** The progress bar's track: 3 px tall, inset 6 px from each side, sitting just inside the bottom
 *  bevel so the tip's last line clears it by 2 px (docs/ADS-PROGRESS.md §2). */
export function adProgressRect(ad: Ad): Rect {
  return { x: ad.x + 6, y: ad.y + ad.h - 7, w: ad.w - 12, h: 3 };
}

/** The progress bar's filled portion, from `ad.ttl` and nothing else: the fraction clamped to 0..1,
 *  rounded to whole pixels, at least 1 px while the ad lives, and mirrored to grow from the right
 *  edge under RTL. */
export function adProgressFillRect(ad: Ad): Rect {
  const track = adProgressRect(ad);
  const frac = Math.min(1, Math.max(0, ad.ttl / AD_LIFETIME_TICKS));
  const w = ad.ttl > 0 ? Math.max(1, Math.round(track.w * frac)) : Math.round(track.w * frac);
  return { x: isRtl() ? track.x + track.w - w : track.x, y: track.y, w, h: track.h };
}

function makeText(text: string): Text {
  return new Text({ text, style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text } });
}

export class AdView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title = makeText('');
  private readonly message = makeText('');
  private readonly tip = new Text({
    text: '',
    style: { fontFamily: FONT, fontSize: FONT_SIZE.small, fill: PAL.text, lineHeight: TIP_LINE_H },
  });
  private seenId: number | null = null;
  private bornTick = 0;

  constructor() {
    this.root.addChild(this.g);
    this.title.anchor.set(0, 0.5);
    this.title.style.fontWeight = 'bold';
    this.message.anchor.set(0, 0.5);
    this.tip.anchor.set(0, 0);
    this.root.addChild(this.title, this.message, this.tip);
  }

  draw(state: RunState): void {
    const g = this.g;
    g.clear();
    const ad = state.ad;
    if (!ad) {
      this.title.text = '';
      this.message.text = '';
      this.tip.text = '';
      this.seenId = null;
      return;
    }
    if (ad.id !== this.seenId) {
      this.seenId = ad.id;
      this.bornTick = state.tick;
      // The tip text object is reused and only reassigned when the ad changes, so the draw path
      // stays allocation-free per frame.
      this.title.text = adTitle(ad.kind);
      this.message.text = adMessage(ad.kind);
      this.tip.text = ad.tip === null ? '' : adTipLines(t(`ads.tip.${ad.tip}`), adTipMaxWidth(ad)).join('\n');
    }

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

    // Reward line, in its pre-tip place, then a 1 px separator and the tip block below it. The tip is
    // empty for Blue Screen: the block and separator still draw, so the trap is never told by shape.
    this.message.style.fill = PAL.text;
    this.message.position.set(ad.x + 6, adRewardLineY(ad));
    const separatorY = adRewardLineY(ad) + 8;
    g.moveTo(ad.x + 2, separatorY + 0.5).lineTo(ad.x + ad.w - 2, separatorY + 0.5).stroke({ width: 1, color: PAL.shadow });
    this.tip.position.set(ad.x + TIP_PAD, separatorY + 2);

    // Progress bar: the tray pop-up's thin bar along the bottom, drawn for every kind from ad.ttl.
    const bar = adProgressRect(ad);
    const fill = adProgressFillRect(ad);
    g.rect(bar.x, bar.y, bar.w, bar.h).fill(PAL.shadow);
    g.rect(fill.x, fill.y, fill.w, fill.h).fill(PAL.title);
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
    this.title.text = t('dlg.ad.systemUpdate');
    this.title.style.fill = PAL.titleInverse;
    this.title.position.set(tray.x + 6, tray.y + 2 + Math.floor(TITLE_H / 2));

    // The countdown to self-close, as a thin bar along the bottom of the body.
    const left = Math.max(0, tray.until - state.clock);
    const body = { x: tray.x + 6, y: tray.y + tray.h - 8, w: tray.w - 12, h: 3 };
    g.rect(body.x, body.y, body.w, body.h).fill(PAL.shadow);
    g.rect(body.x, body.y, Math.round((body.w * left) / TRAY_LIFETIME_TICKS), body.h).fill(PAL.title);

    this.message.text = t('dlg.ad.clickToInstall');
    this.message.style.fill = PAL.text;
    const bodyTop = tray.y + 2 + TITLE_H;
    this.message.position.set(tray.x + 6, bodyTop + Math.floor((tray.h - TITLE_H - 12) / 2));
  }
}
