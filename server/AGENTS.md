# AGENTS.md — `server/`

This guide is for AI agents (and humans pairing with them) editing the **VidVault back-end**. Read `server/CONTEXT.md` before editing; this file explains how to navigate and what conventions to follow.

## Subdirectories & hotspots

- `db/` — the MySQL schema (`schema.sql`) and one-off migrations. See `db/CONTEXT.md`.
  - `db/migrations/` — apply once against an existing DB. See `db/migrations/CONTEXT.md`.
- `src/` — **modular Express API source** (replaces the old monolithic `server.js`). See `server/CONTEXT.md` for module map.
  - `src/routes/` — Express routers grouped by feature/domain. Add new routes here.
  - `src/youtube/` — YouTube Data API v3 fetching logic.
  - `src/uploads/` — Multer + Cloudinary upload helpers.
  - `src/utils/` — ID generators, feed SQL builder, date/duration helpers, category mappings.
  - `src/feed/` — one handler file per video feed `type` (home, tag, category, trending, subscriptions, personalized, watchlater, liked, history, channel, search, related, watch, videobyid, shorts) + `index.js` registry + `helpers.js` shared plumbing. Add a new type by adding a new file here.
  - `src/db/` — MySQL connection (singleton + reconnection logic).
  - `src/config/` — Cloudinary config, `API_KEYS` parsing.
  - `src/email/` — Resend email helper.
- `server.js` — **slim entry point** (~80 lines). Loads env, connects DB, registers route modules, serves static files, starts HTTP server.

## Files here, by purpose

| File | Runtime? | Purpose |
|------|:-:|---------|
| `server.js` | ✅ | Slim entry point. Started by `npm start` / `npm run dev`. |
| `src/` | ✅ | Modular API source (see above). |
| `package.json`, `package-lock.json` | ✅ | Dependencies and `start`/`dev` scripts. |
| `.env.example` | — | Template for required env vars. |
| `db/schema.sql` | — | Authoritative DDL. |
| `db/migrations/001_fix_user_id_fk_target.sql` | — | One-off schema fix. |
| `videoquality.py` | 🔵 (separate deploy) | Current Flask `yt-dlp` service — deployed as `flaskapp-5c1j` on Render. |
| `vq.py`, `vqold.py` | 🔵 (variants) | Older Flask variants kept for reference. Not currently deployed. |
| `requirements.txt` | 🔵 | Flask service deps. |
| `videos.js` | — | Manual seeding script — duplicate of `fetchAndStoreVideos` from `src/youtube`. Run with `node videos.js`. |
| `relatedvideos.js` | — | Sample SQL printer for `createFeedAndGenerateSQL`. |
| `passtohash.js` | — | Tiny dev helper that prints the column name for a friendly label. |
| `abc.cpp` | — | Unrelated C++ scratch problem. Do not wire into the app. |

🔵 = part of the Flask service ecosystem, not started by Node.

## Working in `src/routes/`

- Add new routes under `/api/*` in the appropriate route file (or create a new one for a new domain).
- Use the **callback-style** `connection.query(query, [params], (err, results) => { … })` form. Mirror existing style.
- **Prefer parameterized queries.** The codebase already mixes both styles; do not increase the string-interpolation surface.
- The hotspots of string interpolation remain:
  - `src/utils/createFeedAndGenerateSQL(tags, …)` — builds SQL with tag words inside `LOCATE('word', v.tags)` and excluded IDs in `NOT IN ('a','b',...)`.
  - `src/routes/auth.js` `/api/updateUserDetail` — `UPDATE user SET \`${field}\` = ?` interpolates the **column name** from `req.body.field`.
  - `src/routes/auth.js` `/api/updateChannelDetail` — same pattern for `channels`.
  - `src/youtube/index.js` `getChannelIds(offset, limit)` — interpolates numbers into `LIMIT … OFFSET …`.
  When editing any of these, add an allow-list or parameterization.
- `sendEmail({ to, subject, text })` (in `src/email`) POSTs to Resend. Fire-and-forget on registration; awaited on `/api/feedback`.
- `fetchAndStoreVideos` (in `src/youtube`) uses a **separate** `mysql.createConnection` per call and closes it at the end; do not reuse the main module-level `connection` for this loop.

## YouTube Data API v3

- `API_KEYS` is JSON-parsed in `src/config/index.js`: `JSON.parse(process.env.API_KEYS)`.
- `currentApiKeyIndex` is shared inside `src/youtube/index.js` but **not** with `videos.js` — each file has its own rotation counter.
- `getCategoryName(id)` maps YouTube numeric categories to display strings used in the `category` column of `videos`.
- `convertImageUrl` rewrites `yt3.ggpht.com` → `yt3.googleusercontent.com` and bumps icon size to `s160-c`.
- `isShort = duration <= 61` seconds (the threshold is in `fetchAndStoreVideos`).

## Env vars (see `.env.example`)

`PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`, `API_KEYS` (JSON array), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_EMAIL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. The client also uses `REACT_APP_SERVER_URL` but that's injected at build time and lives in `client/`, not here.

## When you add a new endpoint

1. Add the route in the appropriate file under `src/routes/` (or create a new route file if it's a new domain).
2. Use parameterized `connection.query(sql, [params], cb)` unless there is a strong reason otherwise.
3. If the route mutates DB state, wrap multi-step changes in `connection.beginTransaction` (see `src/routes/auth.js` `/api/deleteUser`).
4. Document the route in `server/CONTEXT.md`'s route module table.
5. If the route needs a new column or table, update `db/schema.sql` and add `db/migrations/NNN_*.sql`.

## When you add a new scheduler / ingestion job

- Several endpoints (`/api/update_channels`, `/api/addnewchannel`) maintain an in-memory `offset` that's incremented per request. Keep that pattern unless you add persistence — note that `offset` resets on every process restart.
- The repo also has `node-cron` as a dependency but it is not currently used. If you wire up a cron, store its state in the DB rather than module locals.

## Local dev vs. production

- Dev: `npm install --include=dev` then `npm run dev` (nodemon on port 5000). The client dev server (port 3000) proxies unknown requests here.
- Prod: Render runs `npm run render-build` at the root then `npm start` here. Express serves `../client/build/` statically and falls back to `index.html` for any unknown path so client-side routing works.

## Port binding (Render)

- `server.js` explicitly logs the bound port and handles `EADDRINUSE` errors.
- `app.listen()` is called unconditionally — it does not depend on DB connection success.
- This ensures Render's port scan detects the open port within the timeout window.

## Don'ts

- Don't add comments unless explicitly requested.
- Don't start the Flask service from inside Node — it's deployed separately.
- Don't commit `.env`. Use `.env.example` as the template, mirroring `render.yaml`'s `envVars`.
- Don't push `API_KEYS`, `DB_PASS`, `RESEND_API_KEY`. Treat them as secrets.
- Don't add new dependencies that overlap existing ones (e.g. another MySQL driver, another HTTP client) without consulting the root `AGENTS.md`.
- Don't import `videos.js`, `relatedvideos.js`, `passtohash.js`, or `abc.cpp` into `src/` — they are standalone exploration/dev files, not libraries.