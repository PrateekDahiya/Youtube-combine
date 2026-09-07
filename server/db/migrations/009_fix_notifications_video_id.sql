-- Migration 009: Make video_id nullable and add new_channel type to notifications
-- Prerequisites: 007_add_notifications_table.sql applied
-- End state: notifications.video_id is nullable, type enum includes 'new_channel'

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Make video_id nullable
ALTER TABLE `notifications` MODIFY `video_id` VARCHAR(32) NULL;

-- Add new_channel to type enum
ALTER TABLE `notifications` MODIFY `type` ENUM('new_video', 'new_short', 'new_channel') NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;