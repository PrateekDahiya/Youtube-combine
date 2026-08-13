# CONTEXT.md — `server/db/migrations/`

## What this directory is

A collection of **one-off SQL migrations** that take an already-provisioned database (running an older revision of `../schema.sql`) and bring it into alignment with the current schema. Each file is numbered (`NNN_<description>.sql`) and should be applied once, in order.

## Contents

| File | Purpose |
|------|---------|
| `001_fix_user_id_fk_target.sql` | Repoints the `user_id` foreign keys in `subscriptions`, `likedvideos`, `history`, `watchlater`, and `comments` from `user(user_id)` to `channels(channel_id)` and narrows the column to `VARCHAR(32)`. Also applies `ON DELETE CASCADE`. Assumptions: `schema.sql` was previously applied with the older (incorrect) FK target. |

## Why this migration exists

Historically the join tables declared `FOREIGN KEY (user_id) REFERENCES user(user_id)`, but every client call (`Card.js`, `Channel.js`, `Watch.js`, etc.) actually populates `user_id` with the logged-in user's **channel_id** (the value stored in the `user` cookie by `Login.js`). The new `schema.sql` and this migration both bring the schema in line with that runtime behavior. The migration is the safe path for existing databases.

## Applying migrations

Migrations are not run automatically by `server.js`. Apply them manually against the target database once:

```bash
mysql -h <host> -P <port> -u <user> -p <database> < 001_fix_user_id_fk_target.sql
```

- Each migration file should be safe to re-run only because dropping the foreign key by name is idempotent — **however** if you've changed constraint names in `schema.sql`, update the `DROP FOREIGN KEY <name>` statements accordingly.
- Always check the current state of `SHOW CREATE TABLE <table>` before running a migration to confirm the constraint names match.

## Convention for adding a migration

1. Name it `NNN_<short_snake_case_description>.sql`, where `NNN` is the next available three-digit number (e.g. `002_…`).
2. At the top of the file, describe the source state it expects and the end state it produces.
3. Make every statement idempotent where possible (`DROP … IF EXISTS`, `ADD … IF NOT EXISTS` or guarded with information_schema checks).
4. Update `../schema.sql` to reflect the new shape so fresh installs get the migration for free.
5. Document any prerequisite here and in `../AGENTS.md`.

There is no `AGENTS.md` in this directory because it has no further subdirectories — see `../AGENTS.md`.
