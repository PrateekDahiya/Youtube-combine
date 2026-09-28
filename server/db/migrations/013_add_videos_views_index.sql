-- Prerequisite: `videos` table exists.
-- Adds a views index so discovery-style feeds can pull the most popular
-- candidate set via an index range scan instead of a full-table filesort.

ALTER TABLE videos ADD KEY idx_video_views (views DESC);
