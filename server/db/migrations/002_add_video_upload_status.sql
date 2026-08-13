-- Prerequisite: `videos` table exists (created by schema.sql).
-- Adds upload_status (0=ready, 1=pending, 2=failed), upload_progress (0-100)
-- and upload_error so user-uploaded videos can be inserted before their
-- Cloudinary upload finishes, hidden from public feeds until ready, and
-- surfaced with a failure reason if the upload fails.
ALTER TABLE videos ADD COLUMN upload_status TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN upload_progress INT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN upload_error VARCHAR(255) NOT NULL DEFAULT '';
