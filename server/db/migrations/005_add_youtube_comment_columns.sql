-- Prerequisite: `comments` table exists with migration 004 applied (updated_at present).
-- Lets YouTube-imported comments live in the same `comments` table as native
-- ones: user_id becomes nullable (NULL for youtube-sourced rows, since those
-- authors aren't rows in `channels`), plus source, external_id (YouTube's
-- own comment id, unique), author_name/author_avatar, and like_count.
ALTER TABLE comments MODIFY user_id VARCHAR(32) NULL;
ALTER TABLE comments ADD COLUMN source ENUM('native', 'youtube') NOT NULL DEFAULT 'native' AFTER user_id;
ALTER TABLE comments ADD COLUMN external_id VARCHAR(64) NULL AFTER source;
ALTER TABLE comments ADD COLUMN author_name VARCHAR(255) NULL AFTER external_id;
ALTER TABLE comments ADD COLUMN author_avatar VARCHAR(512) NULL DEFAULT '' AFTER author_name;
ALTER TABLE comments ADD COLUMN like_count INT NOT NULL DEFAULT 0 AFTER author_avatar;
ALTER TABLE comments ADD UNIQUE KEY uniq_comment_external_id (external_id);
