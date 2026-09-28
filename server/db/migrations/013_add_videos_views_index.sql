-- Prerequisite: `videos` table exists.
-- Adds a views index so discovery-style feeds can pull the most popular
-- candidate set via an index range scan instead of a full-table filesort.

DROP PROCEDURE IF EXISTS add_index_if_missing
CREATE PROCEDURE add_index_if_missing() BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND INDEX_NAME = 'idx_video_views') THEN ALTER TABLE videos ADD KEY idx_video_views (views DESC); END IF; END
CALL add_index_if_missing()
DROP PROCEDURE add_index_if_missing
