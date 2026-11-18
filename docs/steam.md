# Steam wrapper

Pointer Defense is a static web build that ships to GitHub Pages. Steam needs a desktop
application, so the repo now also ships a thin Electron wrapper: it loads `dist/index.html` from
disk in a window and, where Steam is available, reports the game's achievements to the Steamworks
API. Steam is an **addition**, never a dependency — the web build and `npm run dev` are unchanged,
and every Steam failure mode degrades to the plain, fully playable game.

## What the wrapper is (and is not)

- `electron/main.cjs` — the main process. It opens a 1280×800 (min 1024×640) window with a dark
  first paint, `nodeIntegration: false` and `contextIsolation: true`, loads `dist/index.html` from
  disk, and initialises Steam where it can.
- `electron/preload.cjs` — the only bridge between the page and the main process. It exposes a
  single `window.steamBridge.activateAchievement(id)` method and nothing else.
- `src/steam.ts` — the game-side bridge. `main.ts` already detects achievements in the sim; after
  it toasts an unlock it also calls `unlockAchievement(id)`, which forwards to
  `window.steamBridge` when the wrapper is present and is a no-op in the browser.

The wrapper does **not** re-implement any achievement logic. The game (`src/core/state.ts`) remains
the single source of truth for *when* an achievement unlocks; the wrapper only *reports* unlocks the
game has already decided. The unlock path is the existing toast path in `src/main.ts`
(`toastAchievement`), which is the one place every unlock — run achievements and the restart-window
achievement — already flows through.

### Why `steamworks.js`

The bridge uses [`steamworks.js`](https://github.com/ceifa/steamworks.js) rather than the older
`greenworks`:

- It is actively maintained and ships prebuilt N-API binaries for Windows x64, Linux x64 and macOS
  (both x64 and arm64) straight from npm — no local Rust/Clang toolchain, and no per-platform build
  step. `greenworks` requires you to build the native binaries yourself.
- It ships TypeScript declarations and a synchronous `client.achievement.activate(name)` call that
  returns a boolean, which matches this wrapper's fire-and-forget reporting exactly.
- The N-API ABI is stable across Node and Electron, so no `electron-rebuild` is required.

## Development

Requirements are unchanged (Node 22.18+). The Steam client is only needed to exercise the live path;
without it the app still runs.

```
npm install

npm run dev                  # the web build in the browser, exactly as before
npm run build                # web build -> dist/ (base /pointer-defense/, for GitHub Pages)

npm run build:steam          # desktop build -> dist/ with relative asset paths (base ./)
npx electron .               # run the wrapper against dist/ (build:steam first)
```

`npm run build:steam` is the same `tsc && vite build` with `--base=./` so that `dist/index.html`
and the runtime art manifest resolve relative to the file instead of to the GitHub Pages root. The
web `build` and the desktop `build:steam` both write to `dist/`, so run whichever one matches what
you are about to launch.

### The Steam availability gate

On start the main process looks for `steam_appid.txt` (the project root in development, `resources/`
once packaged) and initialises Steam only when it is present and readable. It logs exactly once and
continues without Steam when:

- `steam_appid.txt` is missing, or holds a non-numeric id;
- `require('steamworks.js')` throws (a platform with no Steamworks binary);
- `steamworks.init(appId)` throws (the Steam client is not running).

None of these crash or block the game: the renderer keeps running the normal web build, and
`unlockAchievement` is a no-op because the preload bridge is still there but the main process simply
ignores `steam:activate-achievement` when `steam === null`.

`steam_appid.txt` contains `480` (Spacewar), the Steam app id that works for local development with
no published app. Replace its contents with the real app id at release; the file is copied into the
package by electron-builder, so this is the single place to change it.

## Packaging

`electron-builder` produces two targets, both output to `release/` (gitignored):

```
npm run pack:win      # Windows x64 NSIS installer
npm run pack:linux    # Linux x64 AppImage
npm run pack          # both targets
```

The packaged app includes `dist/` (with `dist/art/`, the manifest and SVGs copied from
`public/art/`), `public/art/` itself, the `electron/` scripts, and `steam_appid.txt`. The
`steamworks.js` native binaries — including `libsteam_api.so` / `steam_api64.dll`, which sit next to
the `.node` binding via its `$ORIGIN`/same-directory runpath — are unpacked from the asar so they
load at runtime.

Cross-compiling note: `steamworks.js` ships every platform's binary in the npm package, so the
Windows binary is present even when packaging from Linux. `electron-builder` can build the NSIS
target on Linux, but a real Steam client test still needs a Windows machine (or a Windows CI runner)
with the Steam client running.

## Achievement mapping

The game's ten achievement ids are reported to Steam under API names of the **same string**:

| Game id (source of truth) | Steam API name |
| --- | --- |
| `first-blood` | `first-blood` |
| `long-road` | `long-road` |
| `clean-wave` | `clean-wave` |
| `sharpshooter` | `sharpshooter` |
| `five-tier-five` | `five-tier-five` |
| `beacon-field` | `beacon-field` |
| `boss-by-pointer` | `boss-by-pointer` |
| `ad-collector` | `ad-collector` |
| `endless-150` | `endless-150` |
| `reboot-50` | `reboot-50` |

The wrapper passes the id through unchanged (`activateAchievement(id)` →
`steam.achievement.activate(id)`), so the Steam API name must match the game id byte-for-byte.

> Note for the partner portal: the Steamworks achievement "API name" field may only accept
> alphanumeric characters and underscores. If the portal rejects the hyphenated ids above, that is a
> registration-time decision — the game is the source of truth, so either the portal accepts the
> exact ids or the ids themselves change in `src/core/achievements.ts` (and the existing saves that
> reference them). Confirm the accepted character set when you register the achievements.

## What still needs a human with a Steamworks account

Everything that requires a real Steam app, real Steam client, and partner-portal access is out of
scope for this repo and is a manual step:

1. **Create the app** in the Steamworks partner portal and obtain the real app id.
2. **Register the ten achievements** in the partner portal, with API names matching the table above.
   This is a manual, partner-portal-only step — no code registers achievements on Steam.
3. Replace `480` in `steam_appid.txt` with the real app id.
4. **Store assets**: capsule images, library art, screenshots and the rest of the Steam store page.
   The Electron app icon is also unset (`electron-builder` falls back to the default icon).
5. **Depot upload**: configure depots and upload the packaged Windows/Linux builds via
   `steamcmd`/SteamPipe.
6. **Test the live path** on a machine with the Steam client running (and the app registered) to
   confirm `steam.achievement.activate` returns true and the overlay/toasts behave.

None of these block the wrapper itself: without a Steamworks account the app still launches, plays,
and persists the local profile exactly as the web build does.
