-- Prerequisite: `user` table exists (created by schema.sql or migration 008).
-- Adds autoplay (1 = on / 0 = off, default on) so the Watch page autoplay
-- toggle persists per user across sessions.

DROP PROCEDURE IF EXISTS add_col_if_missing
CREATE PROCEDURE add_col_if_missing() BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'autoplay') THEN ALTER TABLE user ADD COLUMN autoplay TINYINT(1) NOT NULL DEFAULT 1; END IF; END
CALL add_col_if_missing()
DROP PROCEDURE add_col_if_missing
