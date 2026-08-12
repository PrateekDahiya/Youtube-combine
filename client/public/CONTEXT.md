# CONTEXT.md — `client/public/`

## What this directory is

Create React App's **public** folder: assets that are served as-is at the site root and copied verbatim into `build/`. CRA injects `<script>` and `<link>` tags for the generated JS/CSS bundles into `index.html` at build time.

## Contents

| File | Purpose |
|------|---------|
| `index.html` | The single HTML shell. Title is "VidVault". `<body>` starts hidden and is shown by an inline `onload` handler. Loads Firebase Analytics from gstatic via an inline ES module `<script>` (fire-and-forget; no hosting). The React bundle mounts into `<div id="root">`. |
| `setTheme.js` | Runs before React mounts to apply the saved theme class to `<body>` (avoids a light/dark flash). Reads `localStorage.getItem("theme")`; defaults to `light`. |
| `robots.txt` | Standard open robots: `User-agent: *`, `Disallow:` (allow everything). |
| `Assets/` | Static binary assets. Contains `loading.mp4` — the looping "loading…" video shown by `Videoplayer.js` (`src="/Assets/loading.mp4"`) and `Shortplayer.js` while a real stream URL is being fetched. |
| `AGENTS.md` | Agent-facing guide for editing files in this directory. |

## Notes & gotchas

- `index.html`'s `<meta name="description">` still says "Web site created using create-react-app" — fine to update.
- The Firebase project id `canvas-fulcrum-386304` and API key are committed in plain text in `index.html`. They were historically used for Firebase Hosting; only Analytics runs now. If you remove Firebase, also remove the leftover `.firebase/`, `firebase.json`, `.firebaserc` gitignores.
- Loading assets referenced from `src/` must use absolute paths beginning with `/Assets/...` because CRA serves `public/` at the root. Relative paths will break in the built bundle.
- Don't add ES modules here that need to be bundled — put importable JS in `src/` instead. Files here are copied as-is.
