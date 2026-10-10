-- Prerequisite: 003_fulltext_search.sql applied (ft_videos_search exists on videos).
-- End state: ft_videos_search dropped, freeing its ~200MB+ auxiliary tables.
-- The MATCH..AGAINST call sites already fall back when no FULLTEXT index exists
-- (src/utils/fulltext.js availability gate), so search/personalized keep working.
-- Single-application: tracked by checksum in schema_migrations, skipped on later boots.
ALTER TABLE videos DROP INDEX ft_videos_search;
