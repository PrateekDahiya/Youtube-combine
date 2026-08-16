const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2");

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

const MIGRATIONS_DIR = path.join(__dirname, "../../db/migrations");
const CHANGELOG_FILE = path.join(MIGRATIONS_DIR, "database-migration.json");

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

function getOrderedMigrationFiles() {
    if (!fs.existsSync(CHANGELOG_FILE)) {
        throw new Error(`Changelog file not found: ${CHANGELOG_FILE}`);
    }
    
    const changelog = JSON.parse(fs.readFileSync(CHANGELOG_FILE, "utf8"));
    
    if (!changelog.migrations || !Array.isArray(changelog.migrations)) {
        throw new Error("Invalid changelog format: 'migrations' array required");
    }
    
    return changelog.migrations.map(name => {
        const filePath = path.join(MIGRATIONS_DIR, name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Migration file not found: ${filePath}`);
        }
        return {
            name,
            path: filePath,
            content: fs.readFileSync(filePath, "utf8"),
        };
    });
}

function executeStatements(connection, statements) {
    return new Promise((resolve, reject) => {
        connection.query(statements.join(";\n") + ";", (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

async function runMigrations() {
    const connection = mysql.createConnection(config);
    
    return new Promise((resolve, reject) => {
        connection.connect(async (err) => {
            if (err) {
                connection.end();
                return reject(err);
            }
            
            try {
                await new Promise((res, rej) => {
                    connection.query("SET FOREIGN_KEY_CHECKS = 0", (e) => e ? rej(e) : res());
                });
                
                const applied = await new Promise((res, rej) => {
                    connection.query("SELECT migration_name, checksum FROM schema_migrations ORDER BY id", (e, results) => {
                        if (e) return rej(e);
                        const map = {};
                        results.forEach(row => { map[row.migration_name] = row.checksum; });
                        res(map);
                    });
                });
                
                const migrationFiles = getOrderedMigrationFiles();
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
                    
                    await new Promise((res, rej) => {
                        connection.query(statements.join(";\n") + ";", (e) => e ? rej(e) : res());
                    });
                    
                    await new Promise((res, rej) => {
                        connection.query(
                            "INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)",
                            [migration.name, checksum],
                            (e) => e ? rej(e) : res()
                        );
                    });
                    
                    executedCount++;
                    console.log(`Applied migration: ${migration.name}`);
                }
                
                await new Promise((res, rej) => {
                    connection.query("SET FOREIGN_KEY_CHECKS = 1", (e) => e ? rej(e) : res());
                });
                
                if (executedCount === 0) {
                    console.log("No pending migrations to apply");
                } else {
                    console.log(`Successfully applied ${executedCount} migration(s)`);
                }
                
                connection.end();
                resolve();
            } catch (error) {
                try {
                    await new Promise((res) => {
                        connection.query("SET FOREIGN_KEY_CHECKS = 1", () => res());
                    });
                } catch (e) { /* ignore */ }
                connection.end();
                console.error("Migration failed:", error);
                reject(error);
            }
        });
    });
}

module.exports = { runMigrations };