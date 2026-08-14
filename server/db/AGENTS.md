# AGENTS.md — `server/db/`

This guide is for AI agents (and humans pairing with them) editing the **VidVault MySQL schema**. Read `server/db/CONTEXT.md` before editing; this file explains how to make schema changes safely.

## Subdirectory

- `migrations/` — one-off SQL files applied after `schema.sql`. See `migrations/CONTEXT.md`.

## Files here

| File | Purpose |
|------|---------|
| `schema.sql` | Authoritative DDL for every table. `CREATE TABLE IF NOT EXISTS`, `utf8mb4`, InnoDB. MySQL 8.0+ (uses window functions). |
| `migrations/001_fix_user_id_fk_target.sql` | Repoints `user_id` FKs in `subscriptions`/`likedvideos`/`history`/`watchlater`/`comments` from `user(user_id)` to `channels(channel_id)` (matches the runtime behavior where clients send the logged-in user's `channel_id`). |
| `migrations/004_add_comment_updated_at.sql` | Adds `comments.updated_at` (NULL until edited, refreshed `ON UPDATE`) so `src/routes/comments.js` can distinguish an edited comment. |
| `CONTEXT.md` | Reference doc for table shapes, the `user_id` convention, index recommendations, and applying the schema. |
| `AGENTS.md` | This file. |

## Critical convention: `user_id` is actually `channel_id`

Across `subscriptions`, `likedvideos`, `history`, `watchlater`, and `comments`, the column named `user_id` is **not** a foreign key to `user.user_id`. Every client call (`Card.js`, `Channel.js`, `Watch.js`, `Settings.js`, etc.) populates it with the logged-in user's `channel_id` (the value stored in the `user` cookie by `Login.js`). The FKs in `schema.sql` therefore target `channels(channel_id)` instead. `migrations/001_*` fixes legacy databases that had the wrong FK target.

When adding a route or a table that follows this pattern, the `user_id` column should FK to `channels(channel_id)` and the client must continue sending `channel_id` as the value. Do **not** "correct" the column name to `channel_id` without updating every client and every existing query — the column name is preserved for back-compat.

## When you change the schema

1. **Edit `schema.sql`** so fresh installs get the new shape. Keep `CREATE TABLE IF NOT EXISTS` semantics; do not drop tables.
2. **Add a migration** in `migrations/` for the change:
   - Name the file `NNN_<short_snake_case_description>.sql` (next number after the highest current one).
   - Include prerequisites at the top of the file (what state the DB must already be in).
   - Prefer `ALTER TABLE` over `DROP/CREATE`; preserve data unless explicitly migrating.
   - Make statements idempotent where possible (`DROP FOREIGN KEY IF EXISTS`, etc.). When using non-idempotent statements, document that they must be run exactly once.
3. **Update the route code** in `server/server.js` to match (add the new column to inserts/selects/updates).
4. **Update `CONTEXT.md`** (here and in `migrations/`) so the table summary and migration count stay accurate.
5. **Update `.env.example` / `render.yaml`** only if the change introduces a new env-backed behavior (rare).

## Applying schema for a fresh database

```bash
mysql -h <host> -P <port> -u <user> -p <database> < schema.sql
```

`schema.sql` is idempotent for structure (`CREATE TABLE IF NOT EXISTS`). It does not migrate existing data. If the database already exists at an older revision, run the migrations in `migrations/` in order, then confirm the result against `schema.sql`.

## Applying a migration

```bash
# Always inspect the current table to confirm constraint/column names first:
mysql -h … -P … -u … -p <db> -e "SHOW CREATE TABLE subscriptions \G"
# Then apply:
mysql -h … -P … -u … -p <db> < migrations/001_fix_user_id_fk_target.sql
```

Migrations are **not** run automatically by the Node process. Always apply them by hand against the prod DB after deploying the code change that depends on them (or before, if backward-compatible).

## Index planning

The indexes already cover the hot query patterns in `server.js`. When adding a new WHERE/ORDER BY shape, grep `server/server.js` for the route that produces it and add an index here that covers the leading columns. Common needs:

- `videos.isShort` filter — covered by `idx_video_isshort`.
- `videos.upload_time` (recent-first) — covered by `idx_video_upload_time`.
- `videos.category IN (…)` — covered by `idx_video_category`.
- `videos.channel_id` joins — covered by `idx_video_channel_id`.
- `channels.channel_name` LIKE — covered by `idx_channel_name`. (Note: leading-wildcard `LIKE '%q%'` cannot use this index; consider a fulltext index if/when search is heavy.)

## Don'ts

- Don't add `DROP TABLE` statements to `schema.sql` — it's idempotent and data-preserving.
- Don't write `user_id` FKs to `user(user_id)` in the join tables — follow the established convention of FK to `channels(channel_id)`.
- Don't commit production data dumps or seed data here. The schema and migrations are structure-only.
- Don't add comments to migration SQL beyond a header describing the prerequisite and the end state — keep migrations scannable.
- Don't introduce a new table without also updating `server/CONTEXT.md` and `server/server.js` routes (a table with no route is dead weight).
