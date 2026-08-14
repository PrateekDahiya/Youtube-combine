# CONTEXT.md — `server/`

## What this directory is

The **back-end** of VidVault: a Node.js + Express REST API plus the source for a separately-deployed Flask / `yt-dlp` micro-service, the MySQL schema, and a few helper scripts. In production Render runs `node server.js`; the Flask service is deployed separately to `flaskapp-5c1j.onrender.com`.

## Top-level layout

| File | Role |
|------|------|
| `server.js` | **Slim entry point** (~80 lines). Loads env, connects DB, registers route modules, serves static files, starts HTTP server. |
| `src/` | Modular source code (see below). |
| `package.json` | Express, mysql2, cors, axios, dotenv, googleapis, node-cron, multer, express-session, mssql, mongodb/mongoose (mostly unused), etc. `dev` script uses `nodemon`. |
| `package-lock.json` | Lockfile. |
| `db/schema.sql` | Authoritative MySQL 8.0+ DDL for all tables. See `db/CONTEXT.md`. |
| `db/migrations/` | One-off SQL migrations applied after `schema.sql`. See `db/migrations/CONTEXT.md`. |
| `videoquality.py` | Current Flask service — exposes `/get_video_url` and `/get-short-url` over `yt-dlp`. Deployed as `flaskapp-5c1j` on Render. |
| `vq.py` | Older Flask variant with cookies support and verbose logging. Same routes. Kept for reference. |
| `vqold.py` | Older Flask variant using a custom `MyLogger` and a `get-short-url` that picks a non-best stream URL. Kept for reference. |
| `requirements.txt` | Python deps for the Flask service: `Flask==3.0.3`, `yt-dlp==2024.6.30.232744.dev0`, `Flask-CORS==4.0.1`. |
| `videos.js` | Standalone Node script — duplicate of the `fetchAndStoreVideos` blob that is also in `src/youtube`. Run manually to seed a list of channel IDs. |
| `relatedvideos.js` | Standalone Node script — a precursor of `createFeedAndGenerateSQL` used to print a sample related-videos SQL query for debugging. Not required at runtime. |
| `passtohash.js` | Tiny dev script that prints the DB column name mapped from a friendly "Name" / "Subscribers" label — mirrors the label-to-field maps embedded in `Settings.js` on the client. |
| `abc.cpp` | Unrelated C++ scratch solution (a HackerRank-style problem). Not part of the app. |
| `.env.example` | Template for the required env vars. |
| `AGENTS.md` | Agent-facing guide for working in this directory and its subdirectories. |

## `src/` module layout

| Module | Purpose |
|--------|---------|
| `src/config/` | Cloudinary config, `API_KEYS` parsing, env helpers. |
| `src/db/` | MySQL connection (singleton + reconnection logic), `createNewConnection()` for background jobs. |
| `src/utils/` | ID generators (`generateChannelId`, `generateVideoId`), `sanitizeTag`, `createFeedAndGenerateSQL`, date/duration converters, category mappings, YouTube category helpers. |
| `src/email/` | `sendEmail()` via Resend. |
| `src/uploads/` | Multer config (image + video), Cloudinary upload helpers, background video processing (`processVideoUpload`). |
| `src/youtube/` | YouTube Data API v3 fetching: `fetchAndStoreVideos`, `getChannelIds`, `processChannels`, `getNewChannelId`, `addNewChannel`, API key rotation. |
| `src/routes/` | Express routers grouped by feature/domain (see below). |

## `src/routes/` — route modules

| File | Mounted at | Endpoints |
|------|------------|-----------|
| `health.js` | `/api` | `GET /keep-active`, `GET /health` |
| `feed.js` | `/api` | `/api/home`, `/api/feed-by-tag`, `/api/home-tags`, `/api/shorts`, `/api/subscriptions`, `/api/category`, `/api/trendings`, `/api/search` |
| `videos.js` | `/api` | `/api/watch`, `/api/related-videos`, `/api/personalized-feed`, `/api/getvideobyid`, `/api/getvideosofchannel`, `/api/uploadStatus`, `/api/uploadingVideos`, `/api/updateVideo` |
| `watchlater.js` | `/api` | `/api/watchlater`, `/api/addtowatchlater`, `/api/removefromwatchlater`, `/api/iswatchlater` |
| `likes.js` | `/api` | `/api/likedvideos`, `/api/addtoliked`, `/api/removefromliked`, `/api/isliked` |
| `history.js` | `/api` | `/api/history`, `/api/addtohistory`, `/api/removefromhistory` |
| `subscriptions.js` | `/api` | `/api/addtosubs`, `/api/removefromsubs`, `/api/issub`, `/api/get-subs` |
| `auth.js` | `/api` | `/api/login`, `/api/register`, `/api/getUser`, `/api/updateUserDetail`, `/api/updateChannelDetail`, `/api/deleteUser` |
| `uploads.js` | `/api` | `/api/upload`, `/api/uploadVideo`, `/api/uploadSignature`, `/api/completeVideoUpload` |
| `channels.js` | `/api` | `/api/yourchannel`, `/api/channel`, `/api/getallchannels`, `/api/get-channel-ids`, `/api/update_channels`, `/api/addnewchannel` |
| `feedback.js` | `/api` | `/api/feedback` |

## Runtime architecture of `server.js`

```
require("dns").setDefaultResultOrder("ipv4first");
express()                                            // on port process.env.PORT || 5000
  ├── dotenv.config()
  ├── connectDatabase()                              // src/db — singleton with auto-reconnect
  ├── express.json() + cors()
  ├── app.use("/api", healthRoutes)
  ├── app.use("/api", feedRoutes)
  ├── app.use("/api", videoRoutes)
  ├── app.use("/api", watchlaterRoutes)
  ├── app.use("/api", likesRoutes)
  ├── app.use("/api", historyRoutes)
  ├── app.use("/api", subscriptionRoutes)
  ├── app.use("/api", authRoutes)
  ├── app.use("/api", uploadRoutes)
  ├── app.use("/api", channelRoutes)
  ├── app.use("/api", feedbackRoutes)
  ├── express.static("../client/build")              // served in production
  ├── app.get("*") → sendFile(index.html)            // SPA fallback
  ├── error handler
  └── app.listen(port)                               // logs port, handles EADDRINUSE
```

## Endpoints (same as before, now organized by route module)

See the route module table above for the full list. All endpoints retain their exact paths and behavior.

## YouTube Data API fetching

- Keys come from `API_KEYS` (a JSON env array). `src/youtube/index.js` indexes them with a `currentApiKeyIndex` that is rotated after each fetch inside `fetchAndStoreVideos`.
- `fetchAndStoreVideos(channelId, totalResults, pageToken)`:
  1. `channels.list` for channel details → upsert into `channels`.
  2. Loop `search.list` (50 per page) by `date`, collecting video IDs.
  3. `videos.list` (`snippet,statistics,contentDetails`) → upsert into `videos`. Sets `isShort = duration <= 61` seconds.
- Helpers: `getCategoryName`, `convertImageUrl`, `convertToMySQLDatetime`, `convertDurationToSeconds`.

## Personalized feed algorithm

`createFeedAndGenerateSQL(tags, excludedVideoIds, maxVideosPerChannel, limit)` (in `src/utils`):
- Tokenizes tags into lowercase words, counts duplicates, and scores videos by counting how many of the frequently-occurring words appear in `videos.tags` (`IF(LOCATE('word', v.tags), 1, 0) + ...`).
- Wraps with `ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY video_id) AS channel_row_number` and `WHERE channel_row_number <= maxVideosPerChannel` to cap per-channel contribution.
- **Builds SQL by string interpolation** — `sanitizeTag` only escapes single quotes. When editing, prefer parameterized queries.

## Email (Resend)

- `sendEmail({ to, subject, text })` (in `src/email`) POSTs to `https://api.resend.com/emails` with the `RESEND_API_KEY` bearer.
- Used by `/api/register` (notify `NOTIFY_EMAIL` of a new user) and `/api/feedback` (forward feedback).

## Environment variables (`server/.env.example`)

| Var | Example |
|-----|---------|
| `PORT` | `5000` |
| `DB_HOST` | (Render) |
| `DB_USER` | |
| `DB_PASS` | |
| `DB_NAME` | |
| `DB_PORT` | `3306` |
| `API_KEYS` | `["your-youtube-data-api-key"]` (JSON array) |
| `RESEND_API_KEY` | |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` |
| `NOTIFY_EMAIL` | |
| `CLOUDINARY_CLOUD_NAME` | |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |

## Local dev

1. Copy `.env.example` → `.env` and fill in real values.
2. `npm install` (package.json's `preinstall` sets `omit=dev` on the **client**; not here, so devDeps install normally). To be safe use `npm install --include=dev`.
3. `npm run dev` — `nodemon server.js` on port 5000.
4. For video playback, also run the Flask service: `python videoquality.py` on port 8111 — but the client hard-codes `https://flaskapp-5c1j.onrender.com`, so to use a local instance you must temporarily change the URLs in `src/Watch.js` and `src/Shortbox.js`.

## Security notes to keep in mind when editing

- `/api/updateUserDetail` and `/api/updateChannelDetail` interpolate `req.body.field` directly into a backticked column name. Restrict `field` to a known allow-list before relying on these routes.
- `createFeedAndGenerateSQL` builds SQL by concatenating tag words and excluded IDs. The `sanitizeTag` helper only escapes single quotes — prefer parameterized queries.
- Login is over GET and sends `hashpass` in the query string — consider switching to POST.
- No server-side hashing: the client sends `hashpass` (client-side SHA-256 + base64url, 24 chars). Do not treat it as equivalent to a server-hashed password.
- CORS is wide-open (`app.use(cors())`). Tighten for production if needed.

## When you add a new endpoint

1. Add the route in the appropriate file under `src/routes/` (or create a new route file if it's a new domain).
2. Use parameterized `connection.query(sql, [params], cb)` unless there is a strong reason otherwise.
3. If the route mutates DB state, wrap multi-step changes in `connection.beginTransaction` (see `auth.js` `/api/deleteUser`).
4. Document the route in this file's endpoint table (Verb, Route, Purpose).
5. If the route needs a new column or table, update `db/schema.sql` and add `db/migrations/NNN_*.sql`.

## Port binding (Render fix)

- `server.js` explicitly logs the bound port: `console.log(\`Server running on port \${port}\`)`.
- `server.on("error")` handles `EADDRINUSE` and exits with code 1.
- `app.listen()` is called unconditionally at the bottom of `server.js` — it does not depend on DB connection success.
- This ensures Render's port scan detects the open port within the timeout window.