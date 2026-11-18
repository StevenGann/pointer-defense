// Pointer Defense — Electron preload.
//
// With contextIsolation on and nodeIntegration off this is the only bridge between the sandboxed
// page and the main process, and it exposes exactly one thing: the Steam achievement bridge. The
// game calls `window.steamBridge.activateAchievement(id)` for an unlock it already decided; nothing
// else leaks into the page.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steamBridge', {
  activateAchievement(id) {
    if (typeof id === 'string' && id.length > 0) {
      ipcRenderer.send('steam:activate-achievement', id);
    }
  },
});
