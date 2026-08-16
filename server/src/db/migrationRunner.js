const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createNewPromiseConnection } = require("./index");

const MIGRATIONS_DIR = path.join(__dirname, "../../db/migrations");

function computeChecksum(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}

async function getAppliedMigrations(connection) {
    const [rows] = await connection.execute(
        "SELECT migration_name, checksum FROM schema_migrations ORDER BY id"
    );
    return rows.reduce((acc, row) => {
        acc[row.migration_name] = row.checksum;
        return acc;
    }, {});
}

function getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort();
    return files.map(f => ({
        name: f,
        path: path.join(MIGRATIONS_DIR, f),
        content: fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"),
    }));
}

async function runMigrations() {
    const connection = await createNewPromiseConnection();
    try {
        await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
        
        const applied = await getAppliedMigrations(connection);
        const migrationFiles = getMigrationFiles();
        
        let executedCount = 0;
        
        for (const migration of migrationFiles) {
            const checksum = computeChecksum(migration.content);
            
            if (applied[migration.name]) {
                if (applied[migration.name] !== checksum) {
                    console.warn(
                        `Migration ${migration.name} has been modified after application! ` +
                        `Expected checksum: ${applied[migration.name]}, ` +
                        `actual: ${checksum}. Skipping.`
                    );
                }
                continue;
            }
            
            console.log(`Applying migration: ${migration.name}`);
            
            const statements = migration.content
                .split(";")
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith("--"));
            
            for (const stmt of statements) {
                if (stmt) {
                    await connection.execute(stmt);
                }
            }
            
            await connection.execute(
                "INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)",
                [migration.name, checksum]
            );
            
            executedCount++;
            console.log(`Applied migration: ${migration.name}`);
        }
        
        await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
        
        if (executedCount === 0) {
            console.log("No pending migrations to apply");
        } else {
            console.log(`Successfully applied ${executedCount} migration(s)`);
        }
    } catch (error) {
        await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
        console.error("Migration failed:", error);
        throw error;
    } finally {
        await connection.end();
    }
}

module.exports = { runMigrations };