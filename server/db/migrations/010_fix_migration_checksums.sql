-- Fix checksums for migrations that were modified after application
-- Run this manually to update schema_migrations table with current file checksums

-- 003_fulltext_search.sql
UPDATE schema_migrations SET checksum = '9af5a69b5f2465b9d199af8c249aabb14aaf34cd1b3207c74b3ceb6803c25a2a' WHERE migration_name = '003_fulltext_search.sql';

-- 006_add_migration_tracking.sql
UPDATE schema_migrations SET checksum = 'ad76a8f5cf0a44e0793c23e31b27a57f1a65b9b294de6be64c906b8233908cc4' WHERE migration_name = '006_add_migration_tracking.sql';

-- 007_add_notifications_table.sql
UPDATE schema_migrations SET checksum = 'fe3fd68b4b06f3b1373f019c892d1078648cac2df380f053a99dd206abfc89fe' WHERE migration_name = '007_add_notifications_table.sql';