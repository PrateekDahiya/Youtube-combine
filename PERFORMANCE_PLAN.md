# Performance Refactor Plan

Execution plan for the performance improvements identified on the `performance-refactor` branch. Each item is isolated so it can be reviewed and shipped independently.

## 1. Connection pooling for MySQL

Goal:
- Replace the single shared `mysql.createConnection()` with a `mysql2.createPool()` so concurrent requests don't serialize on one socket.

Plan:
1. Rewrite `server/src/db/index.js` to export `getConnection()` backed by a pool.
2. Keep `createNewConnection()` for `fetchAndStoreVideos` (it opens + closes per call by design).
3. Adjust the reconnect logic: rely on the pool's built-in reconnect/health rather than the manual `connectDatabase()` timer.
4. Regression-check every route still works (all use `getConnection()`).

Files:
- `server/src/db/index.js`

Risk:
- Medium: pool semantics differ (no single shared connection), but all routes are request-scoped already.

## 2. HTTP compression middleware

Goal:
- gzip JSON responses and static assets to cut transfer size.

Plan:
1. Add `compression` as a dependency.
2. Mount `app.use(compression())` before routes/statics in `server/server.js`.
3. Verify `Content-Encoding: gzip` on `/api/*` and `client/build` responses.

Files:
- `server/package.json`
- `server/server.js`

Risk:
- Low.

## 3. Stable pagination (keyset instead of OFFSET)

Goal:
- Replace `LIMIT n OFFSET m` on infinite-scroll feeds with cursor-based pagination so deep pages don't rescan `OFFSET` rows.

Plan:
1. Home (`/api/home`): keyset on `upload_time DESC` (and `video_id` as tiebreaker) using a `before` cursor.
2. `/api/category`, `/api/trendings`, `/api/subscriptions`, `/api/feed-by-tag`, `/api/search`: same treatment where feasible.
3. Return a `nextCursor` (or `hasMore`) in the payload so the client keeps the page key.
4. Keep backward compatibility with the numeric `page` param for a transition period, or update all callers in one commit.
5. Client: change `Home.js`/`Trendings.js`/`Category.js`/`Subscription.js`/`Search.js` to pass the cursor and stop incrementing a page number.

Files:
- `server/src/routes/feed.js`
- `server/src/routes/videos.js`
- `client/src/Home.js`
- `client/src/Trendings.js`
- `client/src/Category.js`
- `client/src/Subscription.js`
- `client/src/Search.js`

Risk:
- Medium: must keep client/server contract in sync; cursor encoding must be consistent.

## 4. Replace `ORDER BY RAND()` on `/api/shorts`

Goal:
- Remove the full-scan + sort cost of `ORDER BY RAND() DESC` and give stable paging on shorts.

Plan:
1. For the "all shorts" branch, order by `video_id` (stable) and let the client supply a `before`/`after` cursor instead of `needmore` offsets.
2. Keep the per-video + same-channel lookup branch unchanged (it is keyed, not random).
3. Optionally preserve a shuffle feel by rotating a cached list of active short ids in memory with a TTL, then paging through it by position.

Files:
- `server/src/routes/feed.js`
- `client/src/Shorts.js`

Risk:
- Medium if shuffle semantics matter; low if a stable order is acceptable.

## 5. FULLTEXT search + tag filtering

Goal:
- Make `/api/search` and `/api/feed-by-tag` use FULLTEXT indexes instead of leading-wildcard `LIKE '%q%'` full scans.

Plan:
1. Add migration `server/db/migrations/002_fulltext_search.sql` adding FULLTEXT indexes on `videos(title, tags)`, `videos(video_description)`, and `channels(channel_name, keywords, short_desc)`.
2. Update `schema.sql` so fresh installs get the same indexes.
3. Rewrite `/api/search` and `/api/feed-by-tag` to use `MATCH ... AGAINST (...)` in BOOLEAN MODE, falling back to `LIKE` for single-word/edge cases if needed.
4. Document the migration in `server/db/migrations/CONTEXT.md`.
5. Verify search returns the same or better results and handles empty/whitespace queries.

Files:
- `server/db/schema.sql`
- `server/db/migrations/002_fulltext_search.sql`
- `server/db/migrations/CONTEXT.md`
- `server/src/routes/feed.js`

Risk:
- Medium: `MATCH` scoring differs from `LIKE`; need a compatibility fallback so results don't regress.

## 6. Response caching for hot read endpoints

Goal:
- Stop recomputing expensive reads on every request.

Plan:
1. Add `node-cache` dependency.
2. Add a TTL cache (30–60s) for `/api/home`, `/api/trendings`, `/api/category`, and `/api/feed-by-tag`.
3. Add a per-user cache (e.g. 60s) keyed by `user_id` for `/api/home-tags` and the `fetchVideoHistory` call in `/api/personalized-feed`.
4. Key caches on the full query-signature (page/cursor/type/category/user) to avoid serving stale cross-tenant data.
5. Keep cache invalidation simple: rely on TTL only; do not add write-through invalidation in this pass.

Files:
- `server/package.json`
- `server/src/routes/feed.js`
- `server/src/routes/videos.js`

Risk:
- Low with short TTLs; must ensure per-user keys so one user's history tags don't leak to another.

## 7. Client code splitting

Goal:
- Shrink the initial bundle by lazy-loading route pages.

Plan:
1. Convert route element imports in `client/src/App.js` to `React.lazy(() => import(...))`.
2. Wrap `<Routes>` (or individual elements) in `<Suspense fallback={...}>` with a lightweight loader.
3. Verify the production build still compiles and routes render as before.

Files:
- `client/src/App.js`

Risk:
- Low; keep `ThemeProvider`/eager shell eager.

## 8. Client image + list rendering

Goal:
- Reduce bandwidth and re-render cost on video grids.

Plan:
1. Add `loading="lazy"` and `decoding="async"` to `Card.js` thumbnails/channel icons.
2. Use smaller YouTube thumbnail URLs where available (e.g. `hqdefault` vs `maxresdefault`) in `Card.js` fallback logic.
3. Wrap `Card` in `React.memo` and `useCallback` the inline click handlers so grid re-renders are cheap.
4. Audit the same pattern in `Shortbox.js` / `Channel.js` thumbnails.

Files:
- `client/src/Card.js`
- `client/src/Shortbox.js`
- `client/src/Channel.js`

Risk:
- Low; behavior-neutral.

## Suggested execution order

1. HTTP compression (low risk, immediate win).
2. Connection pooling for MySQL (biggest server win).
3. Stable keyset pagination (page-2 onward win).
4. Replace `ORDER BY RAND()` on shorts.
5. Response caching for hot read endpoints.
6. FULLTEXT search + tag filtering (schema migration — deploy as its own commit).
7. Client code splitting.
8. Client image + list rendering.

Each item should be its own commit so a regression can be reverted independently.