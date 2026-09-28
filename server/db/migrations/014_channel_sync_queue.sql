-- Prerequisite: `channels` table exists.
-- Adds a crash-safe sync queue (claim/lease/done, never falsely completed)
-- plus per-day API quota tracking for budget guard and quota stand-down.

CREATE TABLE IF NOT EXISTS channel_sync_queue (
    channel_id  VARCHAR(32)     NOT NULL,
    tier        TINYINT         NOT NULL DEFAULT 2,
    score       BIGINT          NOT NULL DEFAULT 0,
    status      ENUM('pending','in_progress','done','failed') NOT NULL DEFAULT 'pending',
    attempts    INT             NOT NULL DEFAULT 0,
    last_error  VARCHAR(512)    NULL,
    next_due    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (channel_id),
    KEY idx_queue_claim (status, next_due, tier, score),
    CONSTRAINT fk_queue_channel FOREIGN KEY (channel_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_quota_usage (
    usage_date      DATE            NOT NULL,
    key_index       INT             NOT NULL,
    search_calls    INT             NOT NULL DEFAULT 0,
    pool_units      INT             NOT NULL DEFAULT 0,
    exhausted_at    DATETIME        NULL,
    PRIMARY KEY (usage_date, key_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
