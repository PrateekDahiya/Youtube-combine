-- Prerequisite: `videos` table exists (created by schema.sql or migration 008).
-- Adds upload_status (0=ready, 1=pending, 2=failed), upload_progress (0-100)
-- and upload_error so user-uploaded videos can be inserted before their
-- Cloudinary upload finishes, hidden from public feeds until ready, and
-- surfaced with a failure reason if the upload fails.

DROP PROCEDURE IF EXISTS add_col_if_missing
CREATE PROCEDURE add_col_if_missing() BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'upload_status') THEN ALTER TABLE videos ADD COLUMN upload_status TINYINT(1) NOT NULL DEFAULT 0; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'upload_progress') THEN ALTER TABLE videos ADD COLUMN upload_progress INT NOT NULL DEFAULT 0; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'upload_error') THEN ALTER TABLE videos ADD COLUMN upload_error VARCHAR(255) NOT NULL DEFAULT ''; END IF; END
CALL add_col_if_missing()
DROP PROCEDURE add_col_if_missing