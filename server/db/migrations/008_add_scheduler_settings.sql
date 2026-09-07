-- Migration 008: Add scheduler_settings table
-- Prerequisites: schema.sql applied (base tables exist)
-- End state: scheduler_settings table created with two default rows for cron expressions

CREATE TABLE IF NOT EXISTS `scheduler_settings` (
    `setting_key` VARCHAR(64) NOT NULL PRIMARY KEY,
    `setting_value` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default cron expressions (every 15 minutes)
INSERT IGNORE INTO `scheduler_settings` (`setting_key`, `setting_value`) VALUES 
    ('channel_update_cron', '*/15 * * * *'),
    ('new_channel_cron', '*/15 * * * *');