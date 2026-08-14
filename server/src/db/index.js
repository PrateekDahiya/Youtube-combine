require("dns").setDefaultResultOrder("ipv4first");
const mysql = require("mysql2");

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
};

const pool = mysql.createPool(config);

function getConnection() {
    return pool;
}

function acquireConnection() {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            else resolve(connection);
        });
    });
}

function createNewConnection() {
    return mysql.createConnection(config);
}

function connectDatabase() {
    console.log("Database pool created");
}

module.exports = {
    getConnection,
    acquireConnection,
    createNewConnection,
    connectDatabase,
};
