-- Prerequisite: `channels` and `videos` tables exist.
-- Adds a materialized prefix index for search typeahead: channel names,
-- video titles (capped at 128 chars) and individual tags, ranked by
-- popularity (subscribers / views / accumulated views).
-- Read path: WHERE term LIKE '<prefix>%' ORDER BY popularity DESC LIMIT 8
-- (btree range scan on idx_suggest_term; always parameterized).

CREATE TABLE IF NOT EXISTS search_suggestions (
    term        VARCHAR(128)    NOT NULL,
    kind        ENUM('video','channel','tag') NOT NULL,
    ref_id      VARCHAR(32)     NOT NULL DEFAULT '',
    popularity  BIGINT          NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, term, ref_id),
    KEY idx_suggest_term (term),
    KEY idx_suggest_pop (popularity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
