# CONTEXT.md — `server/db/`

## What this directory is

Holds the **MySQL schema** and migration SQL for the VidVault database. These files are the authoritative source of truth for table shapes; queries in `server/server.js` and `server/videos.js` assume the structure defined here.

## Contents

| File | Purpose |
|------|---------|
| `schema.sql` | Full DDL for all tables (channels, user, videos, subscriptions, likedvideos, history, watchlater, comments, schema_migrations). Uses `utf8mb4`, InnoDB, MySQL 8.0+ window functions. Safe to run against an empty database (every statement is `CREATE TABLE IF NOT EXISTS`). |
| `migrations/` | One-off SQL migrations applied to an existing database to bring it in line with the current schema. See `migrations/CONTEXT.md`. |
| `AGENTS.md` | Agent-facing guide for editing schema in this directory. |

## Tables (summary — full DDL in `schema.sql`)

| Table | PK | Keys / FKs | Notes |
|-------|----|-----------|-------|
| `channels` | `channel_id VARCHAR(32)` | `idx_channel_name` | Stores YouTube channel metadata. Channel icon/banner are URLs. |
| `user` | `user_id VARCHAR(64)` | `uniq_email` on `email`; `idx_user_channel_id` | `user_id` = login username, `username` = display full name. `channel_id` FK to `channels` (ON DELETE SET NULL). |
| `videos` | `video_id VARCHAR(32)` | `idx_video_channel_id`, `idx_video_category`, `idx_video_upload_time`, `idx_video_isshort` | `isShort TINYINT(1)` = duration ≤ 61. `channel_id` FK to `channels` (ON DELETE CASCADE). `upload_status TINYINT(1)` = 0 ready / 1 pending / 2 failed (for user-uploaded videos); `upload_progress INT` (0-100); `upload_error VARCHAR(255)`. Listing queries filter `upload_status = 0`. |
| `subscriptions` | (`user_id`, `channel_id`) | `idx_sub_channel_id` | **`user_id` here is the logged-in user's `channel_id`, not `user.user_id`** (per the code's behavior; FK points at `channels`). |
| `likedvideos` | (`user_id`, `video_id`) | `idx_liked_video_id` | `user_id` → `channels.channel_id` (CASCADE). `video_id` → `videos.video_id` (CASCADE). |
| `history` | (`user_id`, `video_id`) | `idx_history_video_id` | Same `user_id` convention. `watched_time` default `CURRENT_TIMESTAMP`. |
| `watchlater` | (`user_id`, `video_id`) | `idx_watchlater_video_id` | Same convention. `added_time` default `CURRENT_TIMESTAMP`. |
| `comments` | `comment_id INT AUTO_INCREMENT` | `idx_comment_video_id`, `idx_comment_user_id`, `uniq_comment_external_id` | Backs `src/routes/comments.js`. Two kinds of row via `source`: `native` (app users — `user_id` set, FK to `channels`, ownership-checked on edit/delete) and `youtube` (cached real YouTube commentThreads — `user_id` NULL, `external_id`/`author_name`/`author_avatar`/`like_count` set instead). YouTube rows are populated in bulk by `fetchAndStoreVideos` (`src/youtube/index.js`) and lazily backfilled by `GET /api/youtubeComments`. `updated_at` is NULL until a native comment is edited. |
| `schema_migrations` | `id INT AUTO_INCREMENT` | `uniq_migration_name` | Tracks applied migration files (name + SHA-256 checksum). Populated by `src/db/migrationRunner.js` on service startup. Enables Liquibase-style automatic migration execution. |

## Critical convention: `user_id` in join tables

The `user_id` column in `subscriptions`, `likedvideos`, `history`, `watchlater`, and `comments` does **not** refer to `user.user_id`. Every client call populates it with the logged-in user's `channel_id` (e.g. `Login.js` stores `user.channel_id` in the cookie and components send `user.channel_id` as the `user_id` payload). The FKs in `schema.sql` therefore target `channels(channel_id)`, and `migrations/001_fix_user_id_fk_target.sql` is the one-time fix that bends legacy FKs to match.

## Applying the schema

```bash
mysql -h <host> -P <port> -u <user> -p <database> < schema.sql
```

- The script wraps DDL with `SET NAMES utf8mb4;` and toggles `SET FOREIGN_KEY_CHECKS = 0/1` so it can be run even when FK ordering isn't satisfied.
- All statements are `CREATE TABLE IF NOT EXISTS`, so re-running is idempotent for the structure (it will not alter existing tables).

## Index recommendations

The indexes already cover the hot query patterns:
- `videos.isShort` filter (`idx_video_isshort`) — used by `/api/home`, `/api/shorts`, `/api/category`, `/api/trendings`, `/api/personalized-feed`.
- `videos.upload_time` (`idx_video_upload_time`) — used by trending and `ORDER BY upload_time` queries.
- `videos.category` (`idx_video_category`) — used by `/api/category` and `/api/trendings`.
- `videos.channel_id` and `channels.channel_id` for joins.

If you add a new filter on a leading `LIKE` prefix (currently `videos.title LIKE '%q%'` cannot use the index), consider a fulltext index in the future.

## Notes & gotchas

- `schema.sql` is reverse-engineered from the queries in `server.js` / `videos.js` / `relatedvideos.js`. If you add a route that touches a new column, update `schema.sql` here and add a migration in `migrations/`.
- Prefer parameterized queries in routes (see `server/CONTEXT.md`) — the schema's column widths (`VARCHAR(32)` ids, `VARCHAR(512)` URLs) reflect observed YouTube payloads.
