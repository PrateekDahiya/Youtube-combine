-- Fixes subscriptions/likedvideos/history/watchlater/comments.user_id FKs.
-- They were originally pointed at user(user_id) (the login username), but
-- every client call actually populates this column with the logged-in
-- user's own channel_id (see Card.js, Channel.js, Watch.js, etc.).
-- Run this once against an existing database that already has schema.sql
-- applied with the old (incorrect) FK target.

ALTER TABLE subscriptions DROP FOREIGN KEY fk_sub_user;
ALTER TABLE subscriptions
    MODIFY user_id VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_sub_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE;

ALTER TABLE likedvideos DROP FOREIGN KEY fk_liked_user;
ALTER TABLE likedvideos
    MODIFY user_id VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_liked_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE;

ALTER TABLE history DROP FOREIGN KEY fk_history_user;
ALTER TABLE history
    MODIFY user_id VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_history_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE;

ALTER TABLE watchlater DROP FOREIGN KEY fk_watchlater_user;
ALTER TABLE watchlater
    MODIFY user_id VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_watchlater_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE;

ALTER TABLE comments DROP FOREIGN KEY fk_comment_user;
ALTER TABLE comments
    MODIFY user_id VARCHAR(32) NOT NULL,
    ADD CONSTRAINT fk_comment_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE;
