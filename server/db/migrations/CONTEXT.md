# CONTEXT.md — `server/db/migrations/`

## What this directory is

A collection of **one-off SQL migrations** that take an already-provisioned database (running an older revision of `../schema.sql`) and bring it into alignment with the current schema. Each file is numbered (`NNN_<description>.sql`) and should be applied once, in order.

## Contents

| File | Purpose |
|------|---------|
| `001_fix_user_id_fk_target.sql` | Repoints the `user_id` foreign keys in `subscriptions`, `likedvideos`, `history`, `watchlater`, and `comments` from `user(user_id)` to `channels(channel_id)` and narrows the column to `VARCHAR(32)`. Also applies `ON DELETE CASCADE`. Assumptions: `schema.sql` was previously applied with the older (incorrect) FK target. |
| `002_add_video_upload_status.sql` | Adds `upload_status` (0 ready / 1 pending / 2 failed), `upload_progress` (0-100) and `upload_error` columns to `videos` so user-uploaded videos can be inserted before their Cloudinary upload finishes, hidden from public feeds until ready, and show the failure reason if upload fails. Assumptions: `schema.sql` applied at a revision without these columns. |
| `003_fulltext_search.sql` | Adds FULLTEXT indexes `ft_videos_search` (title, tags, video_description) on `videos` and `ft_channels_search` (channel_name, keywords, short_desc) on `channels` so `/api/search` can use `MATCH ... AGAINST` instead of leading-wildcard `LIKE`. Requires MySQL 8.0+ InnoDB. Assumptions: `videos` and `channels` tables exist. |
| `004_add_comment_updated_at.sql` | Adds `comments.updated_at` (NULL, `ON UPDATE CURRENT_TIMESTAMP`) so an edited comment can be distinguished from an untouched one. Assumptions: `comments` table exists. |
| `005_add_youtube_comment_columns.sql` | Widens `comments` so YouTube-imported comments can live alongside native ones: `user_id` becomes nullable, adds `source` (`native`/`youtube`), `external_id` (YouTube's own comment id, unique), `author_name`, `author_avatar`, `like_count`. Populated during `fetchAndStoreVideos` and backfilled lazily by `GET /api/youtubeComments`. Assumptions: `comments` table exists with migration 004 applied. |
| `006_add_migration_tracking.sql` | Creates `schema_migrations` table to track applied migrations (checksum-based, like Liquibase/Flyway). Enables automatic migration execution on service startup via `src/db/migrationRunner.js`. Assumptions: `schema.sql` applied. |
| `007_add_notifications_table.sql` | Adds `notifications` table to store user notifications when subscribed channels upload new videos/shorts. Includes denormalized `channel_icon`, `thumbnail_link`, `title`, `channel_name`, `upload_time` for quick display without joins. Assumptions: `channels`, `videos`, `user` tables exist. |

## Why this migration exists

Historically the join tables declared `FOREIGN KEY (user_id) REFERENCES user(user_id)`, but every client call (`Card.js`, `Channel.js`, `Watch.js`, etc.) actually populates `user_id` with the logged-in user's **channel_id** (the value stored in the `user` cookie by `Login.js`). The new `schema.sql` and this migration both bring the schema in line with that runtime behavior. The migration is the safe path for existing databases.

## Applying migrations

Migrations are **automatically executed on service startup** by `src/db/migrationRunner.js` (called from `server.js`). The runner:
- Reads all `NNN_*.sql` files from `db/migrations/` in sorted order
- Computes SHA-256 checksum of each file
- Compares against `schema_migrations` table (tracks migration_name + checksum)
- Executes only new/pending migrations in a transaction
- Records each applied migration with its checksum

For manual application (e.g., against a database that predates the tracking table):

```bash
mysql -h <host> -P <port> -u <user> -p <database> < 001_fix_user_id_fk_target.sql
```

- Each migration file should be safe to re-run only because dropping the foreign key by name is idempotent — **however** if you've changed constraint names in `schema.sql`, update the `DROP FOREIGN KEY <name>` statements accordingly.
- Always check the current state of `SHOW CREATE TABLE <table>` before running a migration to confirm the constraint names match.
- If applying manually, also insert a row into `schema_migrations` so the auto-runner doesn't re-apply:
  ```sql
  INSERT INTO schema_migrations (migration_name, checksum)
  VALUES ('001_fix_user_id_fk_target.sql', '<sha256_of_file>');
  ```

## Convention for adding a migration

1. Name it `NNN_<short_snake_case_description>.sql`, where `NNN` is the next available three-digit number (e.g. `002_…`).
2. At the top of the file, describe the source state it expects and the end state it produces.
3. Make every statement idempotent where possible (`DROP … IF EXISTS`, `ADD … IF NOT EXISTS` or guarded with information_schema checks).
4. Update `../schema.sql` to reflect the new shape so fresh installs get the migration for free.
5. Document any prerequisite here and in `../AGENTS.md`.

There is no `AGENTS.md` in this directory because it has no further subdirectories — see `../AGENTS.md`.
