-- Prerequisite: `videos` and `channels` tables exist (created by schema.sql).
-- Adds FULLTEXT indexes so /api/search and /api/feed-by-tag can use
-- MATCH ... AGAINST instead of leading-wildcard LIKE '%q%' full scans.
-- Requires MySQL 8.0+ with InnoDB.
ALTER TABLE videos ADD FULLTEXT INDEX ft_videos_search (title, tags, video_description);
ALTER TABLE channels ADD FULLTEXT INDEX ft_channels_search (channel_name, keywords, short_desc);