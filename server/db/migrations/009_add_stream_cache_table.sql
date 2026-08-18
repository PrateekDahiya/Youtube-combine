CREATE TABLE IF NOT EXISTS `stream_cache` (
  `video_id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `hls_url` TEXT NULL,
  `progressive_json` JSON NULL,
  `adaptive_json` JSON NULL,
  `extraction_ok` BOOLEAN NOT NULL DEFAULT FALSE,
  `cached_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NULL,
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;