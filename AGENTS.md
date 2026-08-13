# AGENTS.md — Root (`Youtube-combine/`)

This guide is for AI agents (and humans pairing with them) editing this repository. Read `CONTEXT.md` here and in each subdirectory before making changes; this file explains **how to navigate the repo** and **what conventions to follow**.

## Repo at a glance

- **VidVault** — a full-stack YouTube clone.
- Monorepo with two deployable apps (`client/`, `server/`) plus a Flask micro-service deployed separately.
- One Render `web` service runs `npm run render-build` then `npm start` (which is `node server/server.js`). Express also statically serves `client/build/`.
- The Flask service lives at `https://flaskapp-5c1j.onrender.com` and is called directly from the browser; its Python source is checked in under `server/` but is **not** started by Node.

## Directory layout & hotspots

- `client/` — React (Create React App) front-end. Component-by-component details in `client/CONTEXT.md` and `client/src/CONTEXT.md`.
  - `src/` — every component, page, context, and co-located CSS lives flat here. See `client/src/CONTEXT.md` for a file-by-file walkthrough.
  - `public/` — static assets and the `index.html` shell. See `client/public/CONTEXT.md`.
- `server/` — Express REST API + Flask sources + DB schema. See `server/CONTEXT.md` for every endpoint and helper.
  - `db/` — MySQL schema and migrations. See `server/db/CONTEXT.md`.
    - `migrations/` — one-off SQL. See `server/db/migrations/CONTEXT.md`.

## Working in this directory

- There is **no runtime code at the root** — only orchestration scripts. Don't add business logic here.
- Before installing, note: the **client** `package.json` has a `preinstall` hook (`npm config set omit=dev`) that drops devDependencies. To get CRA's dev tooling locally, install with `npm install --include=dev`.
- After Node/JS edits, run the available lint from the client: `npm run --prefix client lint` (CRA's built-in ESLint). There is no top-level lint or typecheck because the project is plain JS.
- The repo has **no test suite** beyond CRA's unused scaffold. Don't claim test results unless you actually invoke `npm test`.

## Commands

| Task | Command |
|------|---------|
| Install client | `npm run install:client` |
| Install server (with dev deps) | `npm install --prefix server --include=dev` |
| Build client | `npm run build:client` |
| Render build | `npm run render-build` |
| Start (prod) | `npm start` |
| Dev the server | `npm run --prefix server dev` (nodemon, port 5000) |
| Dev the client | `npm start --prefix client` (CRA dev, port 3000, proxy → 5000) |
| Apply DB schema | `mysql -h … < server/db/schema.sql` (see `server/db/CONTEXT.md`) |
| Apply a migration | `mysql -h … < server/db/migrations/NNN_*.sql` |

## Conventions that cross directories

- **API URL plumbing**: client code reads `process.env.REACT_APP_SERVER_URL` (e.g. `/api` in prod, `http://localhost:5000/api` in dev). Routes in `server.js` are registered under `/api/*`. Don't hard-code `/api` in the client.
- **`user_id` in join tables**: despite the column name, every client call puts the logged-in user's **channel_id** here (not `user.user_id`). The DB schema and migrations reflect this. When you add a route touching `subscriptions`/`likedvideos`/`history`/`watchlater`/`comments`, use `channel_id` as the join key.
- **Password hashing** happens client-side in `Login.js` (`CryptoJS.SHA256` + base64url, 24 chars) and is sent as `hashpass`. There is no server-side hashing. Keep this in mind when you read or modify auth flows.
- **YouTube key rotation**: `API_KEYS` is a JSON array; `server.js` and `videos.js` rotate `currentApiKeyIndex` independently. The two scripts do not share state.
- **Flask service URL** `https://flaskapp-5c1j.onrender.com` is hard-coded in `client/src/Watch.js` and `client/src/Shortbox.js`. If you point the client to a local Flask instance, change both.
- **SQL string-building**: `createFeedAndGenerateSQL`, `/api/updateUserDetail`, `/api/updateChannelDetail`, and `getChannelIds` interpolate values into SQL. Existing `sanitizeTag` only escapes single quotes. When you edit these, prefer parameterized queries and don't introduce new string interpolation of user input.

## Don'ts

- Don't add new top-level runtime code; put it in `client/src/` or `server/`.
- Don't add env vars to `.env*` files and commit them — use `.env.example` templates.
- Don't start the Flask service inside the Node process; it's a separate deployment.
- Don't push database credentials or `API_KEYS`. The root `.gitignore` already covers `cookies.txt` and env files — keep it that way.
- Don't add comments to source unless explicitly asked (per repo convention).

## When you add a new feature

1. **Front-end page**: add `Foo.js` + `Foo.css` in `client/src/`, register a `<Route>` in `client/src/App.js`, link to it from `Menu.js` or `Header.js` if user-facing. Read `client/src/CONTEXT.md` first.
2. **New API endpoint**: add the route in `server/server.js` (the whole API lives in one file). Make it `/api/<route>`. Use parameterized queries when possible. Document the route in `server/CONTEXT.md`.
3. **Schema change**: update `server/db/schema.sql` and add a migration `NNN_*.sql` in `server/db/migrations/`. Update `server/db/CONTEXT.md` and `server/db/migrations/CONTEXT.md`.
4. **New env var**: add it to `server/.env.example` (or `client/.env.example` if purely client-side) and `render.yaml` so Render picks it up.

## Suggested order when an agent first touches the repo

1. Read `CONTEXT.md` (this folder), `client/CONTEXT.md`, `server/CONTEXT.md`, `server/db/CONTEXT.md`.
2. Open `client/src/CONTEXT.md` to map the files to the routes.
3. Open `server/server.js` for endpoint behavior; cross-reference with `server/db/schema.sql` for column shapes.
4. Skim `client/src/App.js` to understand how `user` flows down to every page.
