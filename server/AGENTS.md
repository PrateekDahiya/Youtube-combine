# AGENTS.md — `server/`

This guide is for AI agents (and humans pairing with them) editing the **VidVault back-end**. Read `server/CONTEXT.md` before editing; this file explains how to navigate and what conventions to follow.

## Subdirectories & hotspots

- `db/` — the MySQL schema (`schema.sql`) and one-off migrations. See `db/CONTEXT.md`.
  - `db/migrations/` — apply once against an existing DB. See `db/migrations/CONTEXT.md`.
- `server.js` — the **single runtime entry point**. The entire Express API lives in this one ~1680-line file. If you add a route, add it here, not a new file.

## Files here, by purpose

| File | Runtime? | Purpose |
|------|:-:|---------|
| `server.js` | ✅ | Express app + YouTube fetcher + Resend email + SPA static serving. Started by `npm start` / `npm run dev`. |
| `package.json`, `package-lock.json` | ✅ | Dependencies and `start`/`dev` scripts. |
| `.env.example` | — | Template for required env vars. |
| `db/schema.sql` | — | Authoritative DDL. |
| `db/migrations/001_fix_user_id_fk_target.sql` | — | One-off schema fix. |
| `videoquality.py` | 🔵 (separate deploy) | Current Flask `yt-dlp` service — deployed as `flaskapp-5c1j` on Render. |
| `vq.py`, `vqold.py` | 🔵 (variants) | Older Flask variants kept for reference. Not currently deployed. |
| `requirements.txt` | 🔵 | Flask service deps. |
| `videos.js` | — | Manual seeding script — duplicate of `fetchAndStoreVideos` from `server.js`. Run with `node videos.js`. |
| `relatedvideos.js` | — | Sample SQL printer for `createFeedAndGenerateSQL`. |
| `passtohash.js` | — | Tiny dev helper that prints the column name for a friendly label. |
| `abc.cpp` | — | Unrelated C++ scratch problem. Do not wire into the app. |

🔵 = part of the Flask service ecosystem, not started by Node.

## Working in `server.js`

- Add new routes under `/api/*`. The existing routes use the **callback-style** `connection.query(query, [params], (err, results) => { … })` form. If you write a new route, mirror that style (or use the promise pool only inside `async` helpers — see `fetchVideoHistory` and `fetchAndStoreVideos` for examples).
- **Prefer parameterized queries.** The codebase already mixes both styles; do not increase the string-interpolation surface.
- The four hotspots of string interpolation are:
  - `createFeedAndGenerateSQL(tags, …)` — builds SQL with tag words inside `LOCATE('word', v.tags)` and excluded IDs in `NOT IN ('a','b',...)`.
  - `/api/updateUserDetail` — `UPDATE user SET \`${field}\` = ?` interpolates the **column name** from `req.body.field`.
  - `/api/updateChannelDetail` — same pattern for `channels`.
  - `getChannelIds(offset, limit)` — interpolates numbers into `LIMIT … OFFSET …`.
  When editing any of these, add an allow-list or parameterization.
- `sendEmail({ to, subject, text })` POSTs to Resend. It is fire-and-forget on registration; on `/api/feedback` the result is awaited.
- `fetchAndStoreVideos` uses a **separate** `mysql.createConnection` per call and closes it at the end; do not reuse the main module-level `connection` for this loop.

## YouTube Data API v3

- `API_KEYS` is JSON-parsed at startup: `JSON.parse(process.env.API_KEYS)`.
- `currentApiKeyIndex` is shared inside `server.js` but **not** with `videos.js` — each file has its own rotation counter.
- `getCategoryName(id)` maps YouTube numeric categories to display strings used in the `category` column of `videos`.
- `convertImageUrl` rewrites `yt3.ggpht.com` → `yt3.googleusercontent.com` and bumps icon size to `s160-c`.
- `isShort = duration <= 61` seconds (the threshold is in `fetchAndStoreVideos`).

## Env vars (see `.env.example`)

`PORT`, `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`, `API_KEYS` (JSON array), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_EMAIL`. The client also uses `REACT_APP_SERVER_URL` but that's injected at build time and lives in `client/`, not here.

## When you add a new endpoint

1. Add the `app.get`/`app.post` route in `server.js`. Make it `/api/<route>`.
2. Use parameterized `connection.query(sql, [params], cb)` unless there is a strong reason otherwise.
3. If the route mutates DB state, wrap multi-step changes in `connection.beginTransaction` (see `/api/deleteUser`).
4. Document the route in `server/CONTEXT.md`'s endpoint table (Verb, Route, Purpose).
5. If the route needs a new column or table, update `db/schema.sql` and add `db/migrations/NNN_*.sql`.

## When you add a new scheduler / ingestion job

- Several endpoints (`/api/update_channels`, `/api/addnewchannel`) maintain an in-memory `offset` that's incremented per request. Keep that pattern unless you add persistence — note that `offset` resets on every process restart.
- The repo also has `node-cron` as a dependency but it is not currently used in `server.js`. If you wire up a cron, store its state in the DB rather than module locals.

## Local dev vs. production

- Dev: `npm install --include=dev` then `npm run dev` (nodemon on port 5000). The client dev server (port 3000) proxies unknown requests here.
- Prod: Render runs `npm run render-build` at the root then `npm start` here. Express serves `../client/build/` statically and falls back to `index.html` for any unknown path so client-side routing works.

## Don'ts

- Don't add comments unless explicitly requested.
- Don't start the Flask service from inside Node — it's deployed separately.
- Don't commit `.env`. Use `.env.example` as the template, mirroring `render.yaml`'s `envVars`.
- Don't push `API_KEYS`, `DB_PASS`, `RESEND_API_KEY`. Treat them as secrets.
- Don't add new dependencies that overlap existing ones (e.g. another MySQL driver, another HTTP client) without consulting the root `AGENTS.md`.
- Don't import `videos.js`, `relatedvideos.js`, `passtohash.js`, or `abc.cpp` into `server.js` — they are standalone exploration/dev files, not libraries.
