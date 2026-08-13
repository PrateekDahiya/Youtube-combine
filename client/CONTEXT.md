# CONTEXT.md — `client/`

## What this directory is

The **front-end** of VidVault, a single-page React application bootstrapped with Create React App (`react-scripts ^5.0.1`). It is built to static files in `client/build/` and served in production by the Express server in `server/server.js`. It is not run separately in production; in dev it runs on its own port with a proxy to the API.

## Top-level layout

| Path | Purpose |
|------|---------|
| `package.json` | CRA app manifest. React 18, react-router-dom 6, axios, crypto-js, js-cookie, node-fetch. Dev deps: Babel private-property plugins. |
| `package-lock.json` | Lockfile. |
| `public/` | Static assets served as-is by CRA: `index.html`, `robots.txt`, `setTheme.js`, and `Assets/loading.mp4`. |
| `src/` | All React source — components, pages, context, and co-located CSS. See `src/CONTEXT.md`. |
| `Assets/` | Empty directory (placeholder; nothing referenced from here). The actual loading video lives at `public/Assets/loading.mp4`. |
| `.env.development` | `REACT_APP_SERVER_URL=http://localhost:5000/api` |
| `.env.production` | `REACT_APP_SERVER_URL=/api` |
| `.env.example` | `REACT_APP_SERVER_URL=/api` |
| `.gitignore` | Ignores `node_modules`, `build/`, env files, leftover Firebase config. |
| `AGENTS.md` | Agent-facing guide for working in this directory and its subdirectories. |

## Key `package.json` scripts

- `start` → `react-scripts start` (dev server, port 3000 by default)
- `build` → `react-scripts build` (outputs to `build/`)
- `test` → `react-scripts test` (jest; no project tests actually exist)
- `eject` → `react-scripts eject` (not used)
- `preinstall` → `npm config set omit=dev` (skips devDependencies by default — relevant when installing on Render)

## Important config

- **Proxy**: `"proxy": "http://localhost:5000"` — in dev, unknown requests (e.g. `/api/*`) are proxied to the local Express server.
- **`preinstall` hook** sets `omit=dev`, so a bare `npm install` here will **not** install devDependencies. Override with `npm install --include=dev` when needed.
- ESLint extends `react-app` + `react-app/jest`. A custom `rules` block disables `react-hooks/exhaustive-deps`.
- Browserslist targets modern browsers in dev, >0.2% in prod.

## Environment variables used by the client

| Var | Dev value | Prod value | Used in |
|-----|-----------|------------|---------|
| `REACT_APP_SERVER_URL` | `http://localhost:5000/api` | `/api` | Every component that calls the API. Read via `process.env.REACT_APP_SERVER_URL`. |

## External services called from the browser

- **Flask `yt-dlp` service**: `https://flaskapp-5c1j.onrender.com/get_video_url?video_id=…&quality=…` (Watch page) and `https://flaskapp-5c1j.onrender.com/get-short-url?video_id=…` (Shorts). The code for this service lives in `server/videoquality.py` / `vq.py`; the URL `flaskapp-5c1j.onrender.com` is hard-coded in `src/Watch.js` and `src/Shortbox.js`.
- **Firebase Analytics**: initialized inline in `public/index.html` using a hard-coded Firebase config (project `canvas-fulcrum-386304`). Hosting is not used; only Analytics.
- Static icons are loaded from `cdn-icons-png.flaticon.com` and YouTube thumbnail URLs from `yt3.googleusercontent.com`.

## Auth model on the client

- `Login.js` implements login, registration, feedback, and logout in a single multi-step form driven by a numeric `i` state.
- On success the user object is stored in a cookie named `user` (30-day expiry) via `js-cookie` (`Cookies.set("user", JSON.stringify(user), { expires: 30 })`).
- `App.js` reads the cookie into the `crntuser` state and passes `user` as a prop to every page. `"Guest"` is the sentinel for "not logged in".
- Passwords are hashed **client-side** in `Login.js` using `CryptoJS.SHA256(replaceCharacters(password))` then base64url-encoded and truncated/padded to 24 chars before being sent as `hashpass` to `/api/login` and `/api/register`.
- Logout is triggered by navigating to `/login?type=logout`, which removes the `user` cookie and redirects to `/`.
- The API has no session/JWT — the cookie is purely a client-side cache of the user object returned by `/api/login`.

## Theme model

- `ThemeContext.js` provides `{ theme, toggleTheme }` and persists to `localStorage.theme`.
- `public/setTheme.js` applies the stored theme class to `<body>` before React mounts (prevents flash).
- `themes.css` (in `src/`) holds the light/dark CSS variable definitions.

## Design conventions to follow when editing

- One `.js` + one `.css` per component, co-located in `src/`, PascalCase filenames matching the component name (`Home.js` + `Home.css`, `Card.js` + `Card.css`).
- Components are functional, default-exported, and receive a single `params` prop object (the codebase consistently names it `params`, not `props`).
- API base URL always comes from `process.env.REACT_APP_SERVER_URL`; never hard-code `/api` in a component.
- Format helpers (`formatNumber`, `formatISODate`, `getDateDifference`) are duplicated across several components — when changing one, search for duplicates.
- Routing is in `App.js` using `react-router-dom@6` `Routes`/`Route`. Pages receive `user` (and sometimes `onClick`, `active`, `handleSettings`, `setUser`) as props from `App.js`.
