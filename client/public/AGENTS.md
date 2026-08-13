# AGENTS.md — `client/public/`

This guide is for AI agents (and humans pairing with them) editing the **static shell** of the VidVault CRA app. Read `client/public/CONTEXT.md` before editing; this file explains what to touch and what to leave alone.

## Subdirectory

- `Assets/` — binary assets served at `/Assets/<file>`. Currently only `loading.mp4` (referenced from `Videoplayer.js` and `Shortplayer.js`). See `Assets/CONTEXT.md`. Keep paths absolute (`/Assets/loading.mp4`) when referencing — there is no AGENTS.md inside this subdirectory because it has no further children.

## Files here

| File | Treat as | Notes |
|------|----------|-------|
| `index.html` | The CRA HTML shell | `<title>` is "VidVault". Inline Firebase Analytics is initialized from a hard-coded `canvas-fulcrum-386304` project. The body starts `display:none` until the inline `applyThemeAndShowContent()` runs. Don't introduce new app entry points here — that belongs in `src/index.js`. |
| `setTheme.js` | Pre-React theme bootstrap | Reads `localStorage.theme` and adds `light` / `dark` class to `<body>` to avoid a flash. If you change how themes are stored (e.g. new key or multi-value), update both `setTheme.js` and `src/ThemeContext.js` / `src/themes.css` together. |
| `robots.txt` | Crawl config | Currently open (`Disallow:` empty). If you want thumbnails/preview videos off Google, add `Disallow: /Assets/`. |

## Working in this directory

- CRA copies everything here verbatim into the build root. Files referenced from JavaScript must use **absolute** paths starting with `/` (e.g. `/Assets/loading.mp4`) — never relative URLs.
- Don't put ES modules that need bundling here; CRA does not transform `public/`. Importable JS goes in `src/`.
- Binaries here go to every visitor eagerly — keep them small (the `loading.mp4` is loaded by the video player on the watch page).
- The favicon is currently a remote Flaticon URL in `index.html`; if you add a local one, drop it in `public/` and update the `<link rel="icon">` accordingly.

## Firebase-specific guidance

- `index.html` initializes Firebase Analytics inline. This is analytics-only — the repo no longer uses Firebase Hosting (leftover config in `.gitignore` is for historic builds).
- The Firebase API key in `index.html` is committed intentionally; if you remove Firebase Analytics, also clean `.gitignore` entries for `.firebase/`, `firebase.json`, `.firebaserc`.

## Don'ts

- Don't reference the `../Assets/` empty directory from the HTML/JS — there's nothing there.
- Don't change `<div id="root">` or remove the `<script>` that CRA injects at build time (CRA replaces things at its own placeholders; the file as it stands is the one CRA expects).
- Don't inline app config that the server/env should own. CRA only exposes `REACT_APP_*` env vars via `process.env` in `src/`, not in `public/`.
