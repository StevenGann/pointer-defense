import { Application, Container, Graphics, Text } from 'pixi.js';
import './style.css';

/**
 * M0: toolchain smoke test.
 *
 * Proves the three things the design depends on:
 *   1. Pixi boots and resizes with the window.
 *   2. The board is drawn as vectors, not sprites.
 *   3. The Windows-95 chrome can be drawn in the same scene graph as the board.
 *
 * The real game replaces this file; see docs/architecture.md.
 */

const COLS = 20;
const ROWS = 12;

const app = new Application();
await app.init({
  background: '#008080',
  resizeTo: window,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.getElementById('app')!.appendChild(app.canvas);

type Rect = { x: number; y: number; w: number; h: number };

/** A raised Windows-95 panel: light top-left, dark bottom-right. */
function bevel(g: Graphics, r: Rect, raised = true, face = '#c0c0c0'): void {
  const lw = 2;
  g.rect(r.x, r.y, r.w, r.h).fill(face);
  g.rect(r.x, r.y, r.w, r.h).stroke({ width: lw, color: raised ? '#ffffff' : '#404040' });
  g.moveTo(r.x + r.w - lw, r.y + lw)
    .lineTo(r.x + r.w - lw, r.y + r.h - lw)
    .lineTo(r.x + lw, r.y + r.h - lw)
    .stroke({ width: lw, color: raised ? '#404040' : '#ffffff' });
}

const frame = new Container();
app.stage.addChild(frame);

const board = new Graphics();
const grid = new Graphics();
const chrome = new Container();
const title = new Text({
  text: 'Pointer Defense',
  style: { fontFamily: 'Tahoma, Verdana, sans-serif', fontSize: 13, fill: '#ffffff', fontWeight: 'bold' },
});
const status = new Text({
  text: 'M0 — toolchain online. Towers hold the lane; you click the leaks.',
  style: { fontFamily: 'Tahoma, Verdana, sans-serif', fontSize: 11, fill: '#000000' },
});

chrome.addChild(title, status);
frame.addChild(board, grid, chrome);

function layout(): void {
  const w = app.screen.width;
  const h = app.screen.height;

  const margin = 24;
  const titleH = 22;
  const statusH = 22;

  const availW = w - margin * 2;
  const availH = h - margin * 2 - titleH - statusH - 8;
  const cell = Math.max(8, Math.floor(Math.min(availW / COLS, availH / ROWS)));
  const boardW = cell * COLS;
  const boardH = cell * ROWS;

  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor((h - boardH) / 2) + 4;

  // Title bar
  chrome.removeChildren();
  const bar = new Graphics();
  bevel(bar, { x: ox, y: oy - titleH - 4, w: boardW, h: titleH }, true, '#000080');
  title.position.set(ox + 6, oy - titleH + 2);
  chrome.addChild(bar, title);

  // Status bar
  const sb = new Graphics();
  bevel(sb, { x: ox, y: oy + boardH + 6, w: boardW, h: statusH }, false, '#c0c0c0');
  status.position.set(ox + 6, oy + boardH + 10);
  chrome.addChild(sb, status);

  // Board plate
  board.clear();
  bevel(board, { x: ox - 6, y: oy - 6, w: boardW + 12, h: boardH + 12 }, true, '#c0c0c0');

  // Tiles
  grid.clear();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const gx = ox + x * cell;
      const gy = oy + y * cell;
      grid.rect(gx + 1, gy + 1, cell - 2, cell - 2).fill('#9fd7a6');
      grid.rect(gx + 1, gy + 1, cell - 2, cell - 2).stroke({ width: 1, color: '#6fae78' });
    }
  }
}

app.renderer.on('resize', layout);
layout();
