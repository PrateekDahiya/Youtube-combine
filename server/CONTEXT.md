# CONTEXT.md — `server/`

## What this directory is

The **back-end** of VidVault: a Node.js + Express REST API (`server.js`) plus the source for a separately-deployed Flask / `yt-dlp` micro-service, the MySQL schema, and a few helper scripts. In production Render runs `node server.js`; the Flask service is deployed separately to `flaskapp-5c1j.onrender.com`.

## Top-level layout

| File | Role |
|------|------|
| `server.js` | The Express app — the single runtime entry point. Defines every `/api/*` route, DB connection, health/liveness endpoints, YouTube Data API v3 fetching, and static-serving of `../client/build/` with SPA fallback. ~1680 lines. |
| `package.json` | Express, mysql2, cors, axios, dotenv, googleapis, node-cron, multer, express-session, mssql, mongodb/mongoose (mostly unused), etc. `dev` script uses `nodemon`. |
| `package-lock.json` | Lockfile. |
| `db/schema.sql` | Authoritative MySQL 8.0+ DDL for all tables. See `db/CONTEXT.md`. |
| `db/migrations/` | One-off SQL migrations applied after `schema.sql`. See `db/migrations/CONTEXT.md`. |
| `videoquality.py` | Current Flask service — exposes `/get_video_url` and `/get-short-url` over `yt-dlp`. Deployed as `flaskapp-5c1j` on Render. |
| `vq.py` | Older Flask variant with cookies support and verbose logging. Same routes. Kept for reference. |
| `vqold.py` | Older Flask variant using a custom `MyLogger` and a `get-short-url` that picks a non-best stream URL. Kept for reference. |
| `requirements.txt` | Python deps for the Flask service: `Flask==3.0.3`, `yt-dlp==2024.6.30.232744.dev0`, `Flask-CORS==4.0.1`. |
| `videos.js` | Standalone Node script — duplicate of the `fetchAndStoreVideos` blob that is also inlined in `server.js`. Run manually to seed a list of channel IDs (currently `[""]`). |
| `relatedvideos.js` | Standalone Node script — a precursor of `createFeedAndGenerateSQL` used to print a sample related-videos SQL query for debugging. Not required at runtime. |
| `passtohash.js` | Tiny dev script that prints the DB column name mapped from a friendly "Name" / "Subscribers" label — mirrors the label-to-field maps embedded in `Settings.js` on the client. |
| `abc.cpp` | Unrelated C++ scratch solution (a HackerRank-style problem). Not part of the app. |
| `.env.example` | Template for the required env vars. |
| `AGENTS.md` | Agent-facing guide for working in this directory and its subdirectories. |

## Runtime architecture of `server.js`

```
require("dns").setDefaultResultOrder("ipv4first");   // avoid IPv6 lookup issues
express()                                            // on port process.env.PORT || 5000
  ├── mysql.createConnection(config)                // single shared callback-style conn
  ├── express.json() + cors()                        // global middleware
  ├── GET  /keep-active                              // liveness ping
  ├── GET  /health                                   // SELECT 1; 200/503
  ├── /api/* routes …                                 // ~30 endpoints
  ├── express.static("../client/build")               // served in production
  └── app.get("*") → sendFile(index.html)            // SPA fallback
```

## Endpoints (`server.js`)

| Method | Route | Purpose |
|-------:|-------|---------|
| GET | `/keep-active` | Liveness — returns `{ message: "Server is active" }`. |
| GET | `/health` | Render health check — pings DB with `SELECT 1`, returns 200 or 503. |
| GET | `/api/home?page=` | Random 24 non-short videos per page. |
| GET | `/api/feed-by-tag?tag=&type=&page=` | 24 non-short videos matching a clicked home keyword or video type. |
| GET | `/api/home-tags?user_id=` | Top 5 keyword tags from the logged-in user's watched history. |
| GET | `/api/shorts?video_id=&needmore=` | Short feed; if `video_id` given returns same short + 5 from the same channel. |
| GET | `/api/yourchannel?channel_id=` | Row from `channels` for the logged-in user's channel. |
| GET | `/api/subscriptions?user_id=&isShort=` | Videos from subscribed channels (`user_id` is the logged-in user's **channel_id**). |
| GET | `/api/watch?video_id=` | Video metadata + channel join for the watch page. |
| GET | `/api/channel?channel_id=` | Channel row by id. |
| GET | `/api/category?category=&type=` | Videos by mapped YouTube category (`gaming`, `music`, `movies`, `news`, `sports`, `courses`, `fashionbeauty`, `shopping`). `type` is `isShort`. |
| GET | `/api/related-videos?video_id=` | Tag-based related videos via `createFeedAndGenerateSQL`. |
| GET | `/api/personalized-feed?user_id=&page=` | Builds a feed from the logged-in user's watch history tags. |
| GET | `/api/trendings?type=` | Trending score `LOG(views+1)*0.3 + likes*0.3 + recency*0.4`, last 10 days. `type` 0=all, 1=music, 2=gaming, 3=movies. |
| GET | `/api/search?query=` | LIKE search across `videos.title`, `videos.tags`, `channels.channel_name`. |
| GET | `/api/likedvideos?user_id=` | Liked videos list. |
| GET | `/api/watchlater?user_id=` | Watch-later list. |
| GET | `/api/login?username=&email=&hashpass=` | One-shot login returning the joined `user+channel` row. |
| POST | `/api/register` | Creates channel + user, sends a "New User" notification email via Resend. |
| GET | `/api/getvideobyid?video_id=` | Single video row (used internally). |
| POST | `/api/updateUserDetail` | Updates a field on `user` — **`field` is interpolated into SQL**. |
| POST | `/api/updateChannelDetail` | Updates a field on `channels` — **`field` is interpolated into SQL**. |
| POST | `/api/upload` | `multipart/form-data` file upload (`field: file`). If `CLOUDINARY_*` env vars are set, uploads the image to Cloudinary (folder `vidvault/photos`) and returns `{ url: "<cloudinary secure_url>" }`; otherwise falls back to saving in `server/uploads/` and returns `{ url: "/uploads/<file>" }`. |
| POST | `/api/uploadVideo` | `multipart/form-data` video upload (`video` + optional `thumbnail` + `title`, `description`, `tags`, `category`, `type`, `user_id`). Limit 500 MB (multer). Inserts a row immediately with `upload_status=1` (pending) and returns right away; the Cloudinary upload (folder `vidvault/videos`, thumbnails `vidvault/thumbnails`) runs in the background and updates `link`/`upload_status=0`/`upload_progress` when done, or `upload_status=2` + `upload_error` on failure. `video_count` bumps on completion. Falls back to local `/uploads/<file>` if `CLOUDINARY_*` are unset. |
| GET | `/api/uploadStatus?video_id=` | Returns `{ upload }` — the row's `upload_status`, `upload_progress`, `link`, `upload_error`. Polled by the client while a video uploads. |
| GET | `/api/uploadingVideos?channel_id=` | Returns `{ uploads }` — the channel's videos with `upload_status != 0` (pending/failed), newest first, used by the "Uploads" section on the user's channel page. |
| POST | `/api/getUser` | Returns full `user+channel` join for a `user_id`. |
| POST | `/api/deleteUser` | Transaction that deletes history, watchlater, likedvideos, subscriptions, comments, user, and channel. |
| GET | `/api/getvideosofchannel?channel_id=&type=&query=` | Videos of a channel with optional title LIKE filter. |
| POST | `/api/addtosubs` | Subscribe (`user_chl_id` → `channel_id`). |
| POST | `/api/removefromsubs` | Unsubscribe. |
| GET | `/api/issub?user_id=&channel_id=` | Subscription check. |
| POST | `/api/addtoliked` / `/api/removefromliked` | Like / unlike a video. |
| GET | `/api/isliked?user_id=&video_id=` | Like check. |
| POST | `/api/addtohistory` / `/api/removefromhistory` | Add / remove a history entry (upsert / delete). |
| GET | `/api/history?user_id=` | Watch history (newest first, limit 100). |
| POST | `/api/addtowatchlater` / `/api/removefromwatchlater` | Add / remove watch-later. |
| GET | `/api/iswatchlater?user_id=&video_id=` | Watch-later check. |
| POST | `/api/feedback` | Sends feedback email via Resend and also triggers a `fetchAndStoreVideos` for the requested channel id. |
| GET | `/api/getallchannels` | All `channel_id`s. |
| GET | `/api/get-subs?user_id=` | Subscribed-to channel rows. |
| GET | `/api/get-channel-ids` | All `channel_id`s (alternative). |
| GET | `/api/addnewchannel` | Picks a random popular video's channel and ingests it. |
| GET | `/api/update_channels` | Ingests the next batch (`offset`, `batchSize=5`) of channels in DB. |

## YouTube Data API fetching

- Keys come from `API_KEYS` (a JSON env array). `server.js` indexes them with a `currentApiKeyIndex` that is rotated after each fetch inside `fetchAndStoreVideos`.
- `fetchAndStoreVideos(channelId, totalResults, pageToken)`:
  1. `channels.list` for channel details → upsert into `channels`.
  2. Loop `search.list` (50 per page) by `date`, collecting video IDs.
  3. `videos.list` (`snippet,statistics,contentDetails`) → upsert into `videos`. Sets `isShort = duration <= 61` seconds.
- Helpers: `getCategoryName`, `convertImageUrl`, `convertToMySQLDatetime`, `convertDurationToSeconds`.

## Personalized feed algorithm

`createFeedAndGenerateSQL(tags, excludedVideoIds, maxVideosPerChannel, limit)`:
- Tokenizes tags into lowercase words, counts duplicates, and scores videos by counting how many of the frequently-occurring words appear in `videos.tags` (`IF(LOCATE('word', v.tags), 1, 0) + ...`).
- Wraps with `ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY video_id) AS channel_row_number` and `WHERE channel_row_number <= maxVideosPerChannel` to cap per-channel contribution.
- **Builds SQL by string interpolation** — `sanitizeTag` only escapes single quotes. When editing, prefer parameterized queries.

## Email (Resend)

- `sendEmail({ to, subject, text })` POSTs to `https://api.resend.com/emails` with the `RESEND_API_KEY` bearer.
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
