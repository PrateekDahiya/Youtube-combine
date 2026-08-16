-- Creates the migration tracking table to record which migrations have been applied.
-- This enables automatic migration execution on service startup (like Liquibase/Flyway).
-- Prerequisites: schema.sql applied (tables exist).

CREATE TABLE IF NOT EXISTS schema_migrations (
    id              INT             NOT NULL AUTO_INCREMENT,
    migration_name  VARCHAR(255)    NOT NULL,
    checksum        VARCHAR(64)     NOT NULL,
    applied_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_migration_name (migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;