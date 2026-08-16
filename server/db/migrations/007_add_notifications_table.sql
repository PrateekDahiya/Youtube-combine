-- Migration: Add notifications table
-- Prerequisites: schema.sql has been applied (channels, videos, user tables exist)
-- Run after: 006_add_migration_tracking.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS notifications (
    notification_id     INT             NOT NULL AUTO_INCREMENT,
    user_id             VARCHAR(32)     NOT NULL,
    video_id            VARCHAR(32)     NOT NULL,
    channel_id          VARCHAR(32)     NOT NULL,
    type                ENUM('new_video', 'new_short') NOT NULL,
    title               VARCHAR(512)    NULL,
    channel_name        VARCHAR(255)    NULL,
    channel_icon        VARCHAR(512)    NULL,
    thumbnail_link      VARCHAR(512)    NULL,
    upload_time         DATETIME        NULL,
    is_read             TINYINT(1)      NOT NULL DEFAULT 0,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notifications_user_id (user_id),
    KEY idx_notifications_is_read (is_read),
    KEY idx_notifications_created_at (created_at),
    KEY idx_notifications_user_read_created (user_id, is_read, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_video FOREIGN KEY (video_id)
        REFERENCES videos (video_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_channel FOREIGN KEY (channel_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;