// Pointer Defense — Electron main process.
//
// This wraps the static web build (dist/) in a desktop window and, where the Steam client and the
// Steamworks SDK are available, initialises Steam so the game's existing achievements can be
// reported to Steam. Steam is an addition, never a dependency: every failure mode — a missing
// steam_appid.txt, an absent Steam client, or a platform with no Steamworks binary — logs once and
// falls back to the plain, fully playable web build.

'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Matches the game's own desktop background (PAL.desktop / #008080), so the first paint before the
// canvas clears is never white.
const BACKGROUND = '#008080';

/** The Steamworks client, or null when Steam is unavailable. */
let steam = null;

/** Resolve the steam_appid.txt path: the project root in dev, resources/ once packaged. */
function steamAppIdPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'steam_appid.txt')
    : path.join(app.getAppPath(), 'steam_appid.txt');
}

/**
 * Initialise Steam if it is available, otherwise log once and continue without it. Never throws:
 * a missing app id file, an unreadable id, a platform without a Steamworks binary (the `require`
 * throws), or a Steam client that is not running (the `init` throws) all degrade to the web build.
 */
function initSteam() {
  const appIdFile = steamAppIdPath();
  if (!fs.existsSync(appIdFile)) {
    console.log('[steam] steam_appid.txt missing — running without Steam');
    return;
  }

  let appId;
  try {
    const raw = fs.readFileSync(appIdFile, 'utf8').trim();
    appId = Number(raw);
    if (!Number.isInteger(appId) || appId <= 0) throw new Error(`invalid app id "${raw}"`);
  } catch (err) {
    console.log(`[steam] could not read ${appIdFile} — running without Steam (${err.message})`);
    return;
  }

  try {
    const steamworks = require('steamworks.js');
    steam = steamworks.init(appId);
    console.log(`[steam] initialized for app ${appId}`);
  } catch (err) {
    // The client is not running, or this platform has no Steamworks binary. The game still runs.
    const reason = err instanceof Error ? err.message : String(err);
    console.log(`[steam] Steam unavailable — running without Steam (${reason})`);
  }
}

/** Forward an achievement unlock from the renderer to the Steam client, if one is live. */
ipcMain.on('steam:activate-achievement', (_event, id) => {
  if (steam === null) return;
  if (typeof id !== 'string' || id.length === 0) return;
  try {
    if (steam.achievement.activate(id)) {
      console.log(`[steam] achievement activated: ${id}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[steam] failed to activate achievement ${id} (${reason})`);
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: BACKGROUND,
    webPreferences: {
      // No remote content and no Node access from the page: the renderer is the untrusted web build.
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
}

app.whenReady().then(() => {
  initSteam();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
