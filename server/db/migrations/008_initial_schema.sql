-- Migration 008: Initial schema
-- Creates all base tables from schema.sql for empty databases.
-- This migration is idempotent - safe to run multiple times.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS channels (
    channel_id      VARCHAR(32)   NOT NULL,
    channel_name    VARCHAR(255)  NULL,
    short_desc      TEXT          NULL,
    custom_url      VARCHAR(255)  NULL,
    location        VARCHAR(255)  NULL,
    subscribers     BIGINT        NOT NULL DEFAULT 0,
    date_created    DATETIME      NULL,
    channel_icon    VARCHAR(512)  NULL,
    channel_banner  VARCHAR(512)  NULL,
    video_count     INT           NOT NULL DEFAULT 0,
    total_views     BIGINT        NOT NULL DEFAULT 0,
    keywords        TEXT          NULL,
    PRIMARY KEY (channel_id),
    KEY idx_channel_name (channel_name),
    FULLTEXT KEY ft_channels_search (channel_name, keywords, short_desc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user (
    user_id     VARCHAR(64)   NOT NULL,
    username    VARCHAR(255)  NULL,
    email       VARCHAR(255)  NOT NULL,
    pass        VARCHAR(255)  NOT NULL,
    DOB         DATE          NULL,
    channel_id  VARCHAR(32)   NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uniq_email (email),
    KEY idx_user_channel_id (channel_id),
    CONSTRAINT fk_user_channel FOREIGN KEY (channel_id)
        REFERENCES channels (channel_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS videos (
    video_id            VARCHAR(32)   NOT NULL,
    title               VARCHAR(512)  NULL,
    views               BIGINT        NOT NULL DEFAULT 0,
    likes               BIGINT        NOT NULL DEFAULT 0,
    dislikes            BIGINT        NOT NULL DEFAULT 0,
    link                VARCHAR(512)  NULL,
    upload_time         DATETIME      NULL,
    channel_id          VARCHAR(32)   NULL,
    thumbnail_link      VARCHAR(512)  NULL,
    video_description   TEXT          NULL,
    duration            INT           NOT NULL DEFAULT 0,
    tags                TEXT          NULL,
    category            VARCHAR(64)   NULL,
    isShort             TINYINT(1)    NOT NULL DEFAULT 0,
    upload_status       TINYINT(1)    NOT NULL DEFAULT 0,
    upload_progress     INT           NOT NULL DEFAULT 0,
    upload_error        VARCHAR(255)  NOT NULL DEFAULT '',
    PRIMARY KEY (video_id),
    KEY idx_video_channel_id (channel_id),
    KEY idx_video_category (category),
    KEY idx_video_upload_time (upload_time),
    KEY idx_video_isshort (isShort),
    FULLTEXT KEY ft_videos_search (title, tags, video_description),
    CONSTRAINT fk_video_channel FOREIGN KEY (channel_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id     VARCHAR(32)  NOT NULL,
    channel_id  VARCHAR(32)  NOT NULL,
    sub_time    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, channel_id),
    KEY idx_sub_channel_id (channel_id),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_channel FOREIGN KEY (channel_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS likedvideos (
    user_id     VARCHAR(32)  NOT NULL,
    video_id    VARCHAR(32)  NOT NULL,
    liked_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    KEY idx_liked_video_id (video_id),
    CONSTRAINT fk_liked_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_liked_video FOREIGN KEY (video_id)
        REFERENCES videos (video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS history (
    user_id       VARCHAR(32)  NOT NULL,
    video_id      VARCHAR(32)  NOT NULL,
    watched_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    KEY idx_history_video_id (video_id),
    CONSTRAINT fk_history_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_history_video FOREIGN KEY (video_id)
        REFERENCES videos (video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watchlater (
    user_id     VARCHAR(32)  NOT NULL,
    video_id    VARCHAR(32)  NOT NULL,
    added_time  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    KEY idx_watchlater_video_id (video_id),
    CONSTRAINT fk_watchlater_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_watchlater_video FOREIGN KEY (video_id)
        REFERENCES videos (video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
    comment_id     INT           NOT NULL AUTO_INCREMENT,
    video_id       VARCHAR(32)   NOT NULL,
    user_id        VARCHAR(32)   NULL,
    source         ENUM('native', 'youtube') NOT NULL DEFAULT 'native',
    external_id    VARCHAR(64)   NULL,
    author_name    VARCHAR(255)  NULL,
    author_avatar  VARCHAR(512)  NULL DEFAULT '',
    like_count     INT           NOT NULL DEFAULT 0,
    comment_text   TEXT          NOT NULL,
    comment_time   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id),
    UNIQUE KEY uniq_comment_external_id (external_id),
    KEY idx_comment_video_id (video_id),
    KEY idx_comment_user_id (user_id),
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id)
        REFERENCES channels (channel_id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_video FOREIGN KEY (video_id)
        REFERENCES videos (video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS schema_migrations (
    id              INT             NOT NULL AUTO_INCREMENT,
    migration_name  VARCHAR(255)    NOT NULL,
    checksum        VARCHAR(64)     NOT NULL,
    applied_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_migration_name (migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;