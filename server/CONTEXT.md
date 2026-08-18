# CONTEXT.md — `server/`

## What this directory is

The **back-end** of VidVault: a Node.js + Express REST API, the MySQL schema, and a few helper scripts. In production Render runs `node server.js` — this is the only deployed service; there is no separate microservice. Stream URL resolution for YouTube-sourced videos runs in-process via `youtubei.js` (`src/youtube/streamResolver.js`) rather than a separately-deployed Flask/`yt-dlp` service, since the latter could (and did) go down independently of the main app.

## Top-level layout

| File | Role |
|------|------|
| `server.js` | **Slim entry point** (~80 lines). Loads env, connects DB, registers route modules, serves static files, starts HTTP server. |
| `src/` | Modular source code (see below). |
| `package.json` | Express, mysql2, cors, axios, dotenv, googleapis, node-cron, multer, express-session, mssql, mongodb/mongoose (mostly unused), etc. `dev` script uses `nodemon`. |
| `package-lock.json` | Lockfile. |
| `db/schema.sql` | Authoritative MySQL 8.0+ DDL for all tables. See `db/CONTEXT.md`. |
| `db/migrations/` | One-off SQL migrations applied after `schema.sql`. See `db/migrations/CONTEXT.md`. |
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
| `src/utils/` | ID generators (`generateChannelId`, `generateVideoId`), `sanitizeTag`, `createFeedAndGenerateSQL`, date/duration converters, category mappings, YouTube category helpers, `watchlaterFlag` (attaches `is_watchlater` per row). Feed type handlers live in `src/feed/`, not here. |
| `src/feed/` | Per-type video feed handlers (`home.js`, `tag.js`, `category.js`, `trending.js`, `subscriptions.js`, `personalized.js`, `watchlater.js`, `liked.js`, `history.js`, `channel.js`, `search.js`, `related.js`, `watch.js`, `videobyid.js`, `shorts.js`), auto-registered by `index.js` and backed by shared helpers in `helpers.js`. See the "Unified video endpoint" section. |
| `src/email/` | `sendEmail()` via Resend. |
| `src/uploads/` | Multer config (image + video), Cloudinary upload helpers, background video processing (`processVideoUpload`). |
| `src/youtube/` | YouTube Data API v3 fetching: `fetchAndStoreVideos`, `getChannelIds`, `processChannels`, `getNewChannelId`, `addNewChannel`, API key rotation. Also `streamResolver.js` — resolves a playable stream URL (progressive/adaptive/HLS) for a video via `youtubei.js`, in-process (see "Stream resolution" below). |
| `src/routes/` | Express routers grouped by feature/domain (see below). |

## `src/routes/` — route modules

| File | Mounted at | Endpoints |
|------|------------|-----------|
| `health.js` | `/api` | `GET /keep-active`, `GET /health` |
| `feed.js` | `/api` | `/api/home-tags` |
| `videos.js` | `/api` | `POST /api/videos` (unified video endpoint), `/api/uploadStatus`, `/api/uploadingVideos`, `/api/updateVideo`, `/api/deleteVideo` |
| `watchlater.js` | `/api` | `/api/addtowatchlater`, `/api/removefromwatchlater` |
| `likes.js` | `/api` | `/api/addtoliked`, `/api/removefromliked`, `/api/isliked` |
| `history.js` | `/api` | `/api/addtohistory`, `/api/removefromhistory` |
| `subscriptions.js` | `/api` | `/api/addtosubs`, `/api/removefromsubs`, `/api/issub`, `/api/get-subs` |
| `auth.js` | `/api` | `/api/login`, `/api/register`, `/api/getUser`, `/api/updateUserDetail`, `/api/updateChannelDetail`, `/api/deleteUser` |
| `uploads.js` | `/api` | `/api/upload`, `/api/uploadVideo`, `/api/replaceVideo` |
| `channels.js` | `/api` | `/api/yourchannel`, `/api/channel`, `/api/getallchannels`, `/api/get-channel-ids`, `/api/update_channels`, `/api/addnewchannel` |
| `feedback.js` | `/api` | `/api/feedback` |
| `comments.js` | `/api` | `GET /api/comments`, `/api/addComment`, `/api/editComment`, `/api/deleteComment`, `GET /api/youtubeComments` |
| `stream.js` | `/api` | `GET /api/stream/:videoId` — resolves a playable YouTube stream (see "Stream resolution" below) |
| `notifications.js` | `/api` | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `GET /api/notifications/unread-count` |

## Unified video endpoint (`POST /api/videos`)

**Every endpoint that returns a list of videos goes through one POST route.** The body carries a `type` discriminator plus per-type params; the response is chosen by `type` (factory method in `src/feed/index.js`). This removed the per-card `GET /api/iswatchlater` hover calls: each returned video row now carries `is_watchlater` (0/1) for the calling user.

### `src/feed/` — per-type handlers (open/closed)

Each `type` lives in its own file under `src/feed/` (`home.js`, `tag.js`, `category.js`, `trending.js`, `subscriptions.js`, `personalized.js`, `watchlater.js`, `liked.js`, `history.js`, `channel.js`, `search.js`, `related.js`, `watch.js`, `videobyid.js`, `shorts.js`). `src/feed/index.js` **auto-registers every `*.js` file in the directory** (minus `index.js` and `helpers.js`) as a handler keyed by filename, so adding a new feed type is just dropping in a new file that default-exports an `async (params) => response` function — no edits to the factory or registry. Shared plumbing (cursor helpers, `runQuery`, `cachedQuery`, `cachedFetch`, `flagVideos`, `nextCursorFromVideos`, `httpError`) lives in `src/feed/helpers.js`.

Body: `{ type, user_id?, page?, cursor?, isShort?, tag?, category?, tab?, query?, channel_id?, video_id?, needmore? }`

| `type` | Replaces (removed GET) | Key params | Extra payload |
|--------|------------------------|-----------|---------------|
| `home` | `/api/home` | page, cursor | `nextCursor` |
| `tag` | `/api/feed-by-tag` | `tag` **or** `category` (Music/Gaming/…) | `tag`, `category`, `nextCursor` |
| `category` | `/api/category` | category, isShort, page, cursor | `caticon`, `category`, `nextCursor` |
| `trending` | `/api/trendings` | tab (0=all), page | — |
| `subscriptions` | `/api/subscriptions` | isShort, page, cursor | `nextCursor` |
| `search` | `/api/search` | query, page | `channels`, `query` |
| `personalized` | `/api/personalized-feed` | page | — |
| `watchlater` | `/api/watchlater` | — | `is_watchlater` forced to 1 |
| `liked` | `/api/likedvideos` | — | — |
| `history` | `/api/history` | — | — |
| `channel` | `/api/getvideosofchannel` | channel_id, isShort, query, page | — |
| `related` | `/api/related-videos` | video_id | — |
| `shorts` | `/api/shorts` | video_id?, needmore | `shorts_vIds` |
| `watch` | `/api/watch` | video_id | `data` |
| `videobyid` | `/api/getvideobyid` | video_id | `video` |

**Important:** the `user_id` in the request body is the caller's **channel_id** (consistent with the join-table convention — see root `CONTEXT.md`). When absent, videos are returned without a meaningful flag. The flag is attached centrally via `attachWatchlaterFlag` (`src/utils/watchlaterFlag.js`) inside `helpers.js`, so no handler needs to call it itself. Feed caches store raw rows; the flag is stamped on a shallow copy per request to avoid cache pollution.

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
  ├── app.use("/api", commentRoutes)
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
  4. After its raw connection is released, sequentially (not `Promise.all`, to avoid InnoDB deadlocks under concurrent channel processing) caches a page of YouTube comments per just-synced video — see Comments below.
- Helpers: `getCategoryName`, `convertImageUrl`, `convertToMySQLDatetime`, `convertDurationToSeconds`.
- `fetchAndStoreVideos` uses a raw (non-pooled) `createNewConnection()` per call, wrapped with `guardConnection()` (attaches an `'error'` listener — mysql2 emits connection-level failures like "too many connections" as an event separate from any query callback, and an unhandled one crashes the process) and always released via `finally`, even on error.
- `/api/update_channels` calls `getChannelIdsNeedingUpdate(offset, batchSize, staleDays=3)` instead of scanning every channel — only channels with no videos yet, or whose most-recently-synced video's `upload_time` is older than `staleDays`, are re-processed. `offset` still round-robins through that (shrinking) filtered set and resets to 0 once it's exhausted.
- `/api/addnewchannel` calls `findNewChannelId()`, which loops `getNewChannelId()` (random category → random pick among the top 50 of that category's `mostPopular` chart, not always slot #1) plus a `channelExists()` check up to 15 times until it finds a channel not already in `channels`, instead of accepting the first (likely already-known) candidate and returning `"AlreadyExists"`. `addNewChannel` still re-checks existence itself before syncing as a defensive double-check; if `findNewChannelId` exhausts its attempts, the route returns `"NotFound"` rather than syncing nothing silently.

## Stream resolution (`src/youtube/streamResolver.js`, `src/routes/stream.js`)

`GET /api/stream/:videoId` returns a best-effort playback contract for a YouTube video, resolved entirely in-process via `youtubei.js` — there is no external microservice for this anymore (a previously-separate Flask/`yt-dlp` service was removed after it went down independently of the main app):

```jsonc
{ "video_id": "...", "hls_url": "..." | null, "progressive": [{resolution, itag, bitrate, mimeType, url}], "adaptive": { "video": [...], "audio": [...] }, "extraction_ok": true }
```

- A single module-level `Innertube` client (`getClient()`) is created once and reused across requests.
- `Platform.shim.eval` is wired to Node's `vm` module at module load — `youtubei.js` refuses to execute YouTube's obfuscated deciphering JS unless the host explicitly opts in (security-sensitive by design), so signed format URLs fail to decipher without this.
- Formats are classified by `has_audio`/`has_video`: both → `progressive`; video-only → `adaptive.video`; audio-only → `adaptive.audio`. Each is deciphered via `format.decipher(client.session.player)` and deduped by resolution (highest bitrate wins).
- `extraction_ok` is `false` only when every tier comes back empty (or `getInfo` throws) — the client's iframe fallback is keyed off this flag, not off network errors.
- **Known limitation, empirically confirmed**: YouTube's SABR streaming enforcement means the default WEB client frequently has **no retrievable URL at all** (no plain `url`, no `signature_cipher`) for adaptive (video-only/audio-only) formats — only the 360p progressive format (itag 18) reliably deciphers. Some videos have no progressive format either, in which case `extraction_ok` is `false` and the client falls back to the iframe.

**Client-side playback mode** (`Watch.js`, `Shortbox.js`/`Shortplayer.js`, `Videoplayer.js`): picks `hls` (via `hls.js`, adaptive quality with no custom sync) > `progressive` (single `<video src>`) > `adaptive` (legacy dual `<video>`+`<audio>` element sync, kept only as a fallback) based on whichever tier the response populated, falling back to a YouTube `<iframe>` only when `extraction_ok` is `false`.

## Comments (`src/routes/comments.js`)

One `comments` table holds both kinds of comment, discriminated by `source`:
- **Native** (`source = 'native'`): app users. `video_id`, `user_id` = commenter's `channel_id` (FK to `channels`), `comment_text`, `comment_time`, `updated_at` (NULL until edited). `GET /api/comments?video_id=` lists them newest-first joined with `channels` for the commenter's name/icon; `/api/addComment`, `/api/editComment`, `/api/deleteComment` are ownership-checked (`WHERE ... AND user_id = ?`, `affectedRows === 0` → 403/404).
- **YouTube** (`source = 'youtube'`): cached real YouTube commentThreads (`maxResults: 10`), `user_id` NULL, `external_id` (YouTube's own comment id, unique), `author_name`, `author_avatar`, `like_count` filled in instead. Two ways they get populated:
  1. In bulk — `fetchAndStoreVideos` (`src/youtube/index.js`) fetches and upserts (`ON DUPLICATE KEY UPDATE` by `external_id`) a page of comments for each video it just synced, so `/api/update_channels` and `/api/addnewchannel` warm the cache as a side effect of importing videos.
  2. On demand — `GET /api/youtubeComments?video_id=&page_token=` reads the cache first (`LIMIT 10`); if a video has no cached rows yet, it checks whether `video_id` exists in `videos` first — `comments.video_id` FKs to `videos.video_id`, so caching a comment for a video we've never synced would fail that constraint on every request. If the video exists locally, it live-fetches via `commentThreads.list` (same `API_KEYS` rotation as video import) and upserts (with deadlock retry) before returning; if not, it still live-fetches for display but skips the cache write.
  Only meaningful for videos whose `video_id` is a real YouTube video ID (imported videos, not user-uploaded ones); returns `{ comments: [], disabled: true }` on a 403/404 (comments disabled or video not found upstream) rather than erroring. Read-only — there is no way to post to real YouTube from this API key.

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
3. `npm run dev` — `nodemon server.js` on port 5000. Video playback works out of the box — stream resolution runs in-process (see "Stream resolution" above), no separate service to start.

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