import { Application, Container, Graphics } from 'pixi.js';
import './style.css';
import { createRunState, step } from './core/state.ts';
import { ChromeView, computeLayout, PAL, type Layout } from './view/chrome.ts';
import { BoardView } from './view/board.ts';
import { HudView } from './view/hud.ts';
import { PopupView } from './view/popup.ts';
import { FloatingNumbersView } from './view/numbers.ts';
import { MouseController } from './input/mouse.ts';

const app = new Application();
await app.init({
  background: PAL.desktop,
  resizeTo: window,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.getElementById('app')!.appendChild(app.canvas);
app.canvas.style.cursor = 'none';

let state = createRunState();
let layout: Layout = computeLayout(app.screen.width, app.screen.height);

const chrome = new ChromeView();
const board = new BoardView();
const hud = new HudView();
const popup = new PopupView();
const numbers = new FloatingNumbersView();

const root = new Container();
app.stage.addChild(root);
root.addChild(chrome.root, popup.root, board.root, numbers.root, hud.root);

function syncViewport(): void {
  state.viewport = {
    width: app.screen.width,
    height: app.screen.height,
    window: { x: layout.window.x, y: layout.window.y, w: layout.window.w, h: layout.window.h },
  };
}
syncViewport();

const cursor = new Graphics();
drawCursorArrow(cursor);
root.addChild(cursor);

const mouse = new MouseController(app, {
  layout: () => layout,
  state: () => state,
  restart: () => {
    state = createRunState();
    syncViewport();
  },
  notice: (message) => hud.showNotice(message),
});

function drawCursorArrow(g: Graphics): void {
  g.clear();
  g.poly([0, 0, 0, 13, 3.5, 10, 5.5, 16, 8, 14, 6.5, 10, 11, 10])
    .fill(PAL.highlight)
    .stroke({ width: 1, color: PAL.dark });
}

app.ticker.add((ticker) => {
  const alpha = step(state, ticker.deltaMS);
  chrome.draw(layout, mouse.hover.menuItem);
  board.draw(state, layout, alpha, { col: mouse.hover.col, row: mouse.hover.row, onBoard: mouse.hover.onBoard });
  numbers.draw(state, layout);
  hud.draw(state, layout, mouse.hover.hud);
  popup.draw(state);
  cursor.position.set(mouse.hover.x, mouse.hover.y);
});

app.renderer.on('resize', () => {
  layout = computeLayout(app.screen.width, app.screen.height);
  syncViewport();
});
