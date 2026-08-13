# AGENTS.md — `client/`

This guide is for AI agents (and humans pairing with them) editing the **VidVault front-end**. Read `client/CONTEXT.md` and `client/src/CONTEXT.md` before editing; this file explains how to navigate and what conventions to follow.

## Subdirectories & hotspots

- `src/` — every React component, page, context, and co-located CSS lives flat here. Start with `src/CONTEXT.md` for a file-by-file map and `src/App.js` to see how `user`/routes flow.
- `public/` — CRA's static folder; the `index.html` shell, `setTheme.js`, theme bootstrap, and `Assets/loading.mp4`. See `public/CONTEXT.md`.
  - `public/Assets/` — `loading.mp4` placeholder video, referenced by absolute path `/Assets/loading.mp4`. See `public/Assets/CONTEXT.md`.
- `Assets/` — empty placeholder. Don't put code here.

## Working in this directory

- This is a Create React App (`react-scripts ^5.0.1`) project. There is no custom webpack/Vite config; don't introduce one without reason.
- **`preinstall` hook** sets `npm config set omit=dev`, so a bare `npm install` will **not** install devDependencies (notably Babel private-property plugins and `@testing-library/*`). When you need dev tooling, install explicitly: `npm install --include=dev`.
- ESLint config extends `react-app` + `react-app/jest`; `react-hooks/exhaustive-deps` is **off**. Don't fight the existing ESLint; if you change the config, run `npm run lint` (CRA's built-in) to verify.
- There are **no project tests** despite the CRA `test` script. Don't claim a test run unless you actually execute `npm test` and add a real `*.test.js`.

## Commands

| Task | Command |
|------|---------|
| Install (runtime deps only) | `npm install` (uses the `preinstall` hook to `omit=dev`) |
| Install with dev deps | `npm install --include=dev` |
| Dev server | `npm start` (port 3000, proxy → http://localhost:5000) |
| Build | `npm run build` → `build/` (served by the Express server in prod) |
| Lint (CRA) | `npm run lint` (or `npx eslint src/`) |

## Cross-directory conventions

- **API base URL**: every component declares `const serverurl = process.env.REACT_APP_SERVER_URL;` and calls `${serverurl}/<route>` where `<route>` is **without** the `/api` prefix (the env value includes it). Never hard-code `/api` in a component.
- **`user` prop**: `App.js` reads the `user` cookie into `crntuser` and passes it as the `user` prop to every page. `user === "Guest"` is the sentinel for signed-out. Pages propagate `user.channel_id` (the logged-in user's **channel_id**, see root `AGENTS.md`) when calling subscription / like / history / watch-later endpoints.
- **External Flask service**: `https://flaskapp-5c1j.onrender.com` is hard-coded in `src/Watch.js` and `src/Shortbox.js`. To use a local Flask instance, change both (no env var exists for this URL today).
- **Firebase Analytics** is initialized inline in `public/index.html`. If you remove Firebase, also clean up `.gitignore` entries (`.firebase/`, `firebase.json`, `.firebaserc`).

## Environment files

| File | Used by | `REACT_APP_SERVER_URL` |
|------|---------|-------------------------|
| `.env.development` | `npm start` | `http://localhost:5000/api` |
| `.env.production` | `npm run build` (build-time embed) | `/api` |
| `.env.example` | Template | `/api` |

`.env*` files (other than `.env.example`) are gitignored — don't commit them. Add new `REACT_APP_*` vars to `.env.example` and reference via `process.env.REACT_APP_*` only (CRA does not inline non-`REACT_APP_`-prefixed vars).

## When you add a new page

1. Create `Foo.js` + `Foo.css` in `src/` (default export, functional, accepts a `params` prop — the codebase calls the argument `params`, not `props`).
2. Add a `<Route>` in `src/App.js`. Pass the props the page needs (`user`, `active`, `onClick`, `handleSettings`, `setUser`, etc.).
3. If the page is user-facing, link to it from `src/Menu.js` (sidebar) and/or `src/Header.js` (profile dropdown). Update `Menu.js`'s `selectedItem` switch in its `useEffect` so the active state highlights correctly.
4. Use `Card`/`Cardloading` for video grids; prefer reuse over rolling a new card component.
5. If the page calls the API, declare `const serverurl = process.env.REACT_APP_SERVER_URL;` and call `${serverurl}/<route>` (no `/api` prefix).
6. Update `src/CONTEXT.md` with the new entry in the file-by-file table.

## When you add a new shared component

- Keep it PascalCase + co-located CSS + flat in `src/`. Default export. Use `params` for the prop name to match the rest of the codebase (or, where unavoidable, `props` — be consistent within the file).
- If the component needs the current user, read it from the `user` cookie with `Cookies.get("user")` and `JSON.parse`, with a `"Guest"` fallback — pattern is already in `Card.js` and `Header.js`.
- Don't duplicate `formatNumber` / `formatISODate` / `getDateDifference` / `formatDuration` yet again if a nearby component already has them — search first.

## Don'ts

- Don't add comments unless explicitly requested.
- Don't import from `../Assets/` — it's empty. For static binary assets use `public/Assets/` and absolute paths.
- Don't write a server-side auth check; the cookie is purely a client-side cache. There is no JWT/session in the API.
- Don't add a new top-level dependency without checking the root `AGENTS.md` and the rest of the package's conventions.
