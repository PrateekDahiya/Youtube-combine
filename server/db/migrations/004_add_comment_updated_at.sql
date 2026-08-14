-- Prerequisite: `comments` table exists (created by schema.sql).
-- Adds updated_at so an edited comment can be distinguished from an
-- untouched one; NULL until the comment is first edited, then refreshed
-- automatically on every subsequent update.
ALTER TABLE comments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER comment_time;
