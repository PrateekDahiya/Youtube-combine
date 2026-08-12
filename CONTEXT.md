# CONTEXT.md — Root (`Youtube-combine/`)

## What this directory is

The repository root for **VidVault** (a.k.a. "Youtube-combine"), a full-stack YouTube clone. It is a monorepo that orchestrates two deployable apps and a Python video-streaming microservice, all deployed together to Render as a single web service.

## Top-level layout

| Path | Purpose |
|------|---------|
| `client/` | React (Create React App) front-end. Built to static files and served by the Express server. |
| `server/` | Node.js + Express REST API (`server.js`) plus a Flask/`yt-dlp` micro-service (`videoquality.py`, `vq.py`, `vqold.py`) for fetching direct YouTube stream URLs. Also holds the MySQL schema and helper scripts. |
| `package.json` | Workspace orchestration scripts only — no runtime code lives here. |
| `render.yaml` | Render Blueprint. Defines one `node` web service that installs + builds the client, installs the server, and serves both from `npm start`. |
| `.gitignore` | Ignores `node_modules`, `build/`, `dist/`, env files, `cookies.txt`, leftover Firebase config. |
| `AGENTS.md` | Agent-facing guide for working in this directory and its subdirectories. |

## Workspace scripts (`package.json`)

- `install:client` → `npm install --prefix client`
- `install:server` → `npm install --prefix server`
- `build:client` → `npm run build --prefix client` (produces `client/build/`)
- `render-build` → `install:client && build:client && install:server` (Render build command)
- `start` → `npm start --prefix server` (Render start command; Express serves `client/build/`)

## High-level architecture

```
 browser  ──HTTP──►  Express (server/server.js, port 5000)
                        │
                        ├── /api/*    → MySQL queries (mysql2) + YouTube Data API v3 fetcher
                        ├── /health  → Render health check (DB ping)
                        ├── /keep-active → liveness ping
                        └── static + SPA fallback → client/build/index.html

 Express also calls out (server-side) to:
   • YouTube Data API v3  (search.list, videos.list, channels.list) using rotating API_KEYS
   • Resend email API     (new-user registration + feedback notifications)

 The browser (client) also calls out directly to:
   • Flask app https://flaskapp-5c1j.onrender.com  (yt-dlp service for stream URLs)
```

The Flask service code lives in `server/videoquality.py` (and the older `vq.py` / `vqold.py` variants) but is **deployed separately** to a Render service named `flaskapp-5c1j`. It is not started by the Node server.

## Key API endpoints (summary; full list in `server/CONTEXT.md`)

`/api/home`, `/api/shorts`, `/api/watch`, `/api/related-videos`, `/api/personalized-feed`, `/api/trendings`, `/api/search`, `/api/category`, `/api/channel`, `/api/yourchannel`, `/api/subscriptions`, `/api/issub` `/api/addtosubs` `/api/removefromsubs`, `/api/isliked` `/api/addtoliked` `/api/removefromliked`, `/api/iswatchlater` `/api/addtowatchlater` `/api/removefromwatchlater`, `/api/history` `/api/addtohistory` `/api/removefromhistory`, `/api/login` (GET), `/api/register` (POST), `/api/updateUserDetail`, `/api/updateChannelDetail`, `/api/getUser`, `/api/deleteUser`, `/api/getvideosofchannel`, `/api/get-subs`, `/api/feedback`, `/api/getallchannels`, `/api/get-channel-ids`, `/api/update_channels`, `/api/addnewchannel`.

## Data model overview (MySQL 8.0+)

See `server/db/schema.sql` for the authoritative DDL. Core tables:

- `channels` — YouTube channels (PK `channel_id VARCHAR(32)`). Channel icon/banner stored as URLs.
- `user` — local app users. `user_id` is the login **username**; `username` is the display/full name. FK `channel_id → channels`.
- `videos` — video metadata fetched from YouTube. `isShort = duration <= 61`.
- `subscriptions`, `likedvideos`, `history`, `watchlater` — join tables. **Important quirk:** the `user_id` column in these tables stores the logged-in user's **channel_id**, not `user.user_id` (this is what every client call populates; the FKs in `schema.sql` and `migrations/001_fix_user_id_fk_target.sql` already reflect this).
- `comments` — declared in schema but not yet inserted/selected by any route (only cascaded DELETE on user removal).

## Environment variables

- Root: none.
- `render.yaml` declares: `NODE_VERSION=20`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`, `API_KEYS` (JSON array of YouTube Data API keys), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_EMAIL`, `REACT_APP_SERVER_URL=/api`.
- See `server/.env.example` and `client/.env.example` for local-dev templates.

## Conventions worth knowing before editing

- The front-end talks to the API using `${process.env.REACT_APP_SERVER_URL}/<route>` where the route is **without** the `/api` prefix in code but the env value includes `/api`. In local dev the proxy (`client/package.json` → `http://localhost:5000`) is also used.
- Passwords are hashed client-side in `Login.js` (`stringToHash` with CryptoJS SHA-256 + a character substitution + base64url, truncated/padded to 24 chars) and sent to `/api/login` / `/api/register`. There is no server-side hashing.
- The YouTube fetcher rotates keys from the `API_KEYS` array via a `currentApiKeyIndex` counter.
- Several endpoints interpolate user input into SQL string literals (e.g. `createFeedAndGenerateSQL`, `/api/updateUserDetail`, `/api/updateChannelDetail`). When editing these, prefer parameterized queries.
- No test suite is wired up at the root; tests exist only for the CRA client scaffold (unused).

## Build & run (local)

1. Create `server/.env` from `server/.env.example` (fill DB credentials + at least one `API_KEYS` entry).
2. `npm run install:server` then `npm run dev` inside `server/` (uses `nodemon`).
3. Create `client/.env.development` from `client/.env.example` (already committed here: `REACT_APP_SERVER_URL=http://localhost:5000/api`).
4. `npm run install:client` then `npm start` inside `client/`.
5. (Optional) Start the Flask service separately for in-browser video playback: `python server/videoquality.py` on port 8111, or rely on the deployed `flaskapp-5c1j.onrender.com`.

## Build & run (production / Render)

- `npm run render-build` installs client deps, builds the client, then installs server deps.
- `npm start` runs `node server/server.js`, which also statically serves `client/build/` and falls back to `index.html` for unknown routes (SPA behavior).
- Health check: `GET /health` returns 200/503 depending on DB reachability.
