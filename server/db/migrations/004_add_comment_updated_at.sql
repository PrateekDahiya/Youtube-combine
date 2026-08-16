-- Prerequisite: `comments` table exists (created by schema.sql or migration 008).
-- Adds updated_at so an edited comment can be distinguished from an
-- untouched one; NULL until the comment is first edited, then refreshed
-- automatically on every subsequent update.

DROP PROCEDURE IF EXISTS add_updated_at
CREATE PROCEDURE add_updated_at() BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'updated_at') THEN ALTER TABLE comments ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER comment_time; END IF; END
CALL add_updated_at()
DROP PROCEDURE add_updated_at