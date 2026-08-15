require("dns").setDefaultResultOrder("ipv4first");
const mysql = require("mysql2");
const mysqlPromise = require("mysql2/promise");

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

// Callback-style connection.execute()/query() with no callback does not
// return a real promise — it queues the command and returns immediately, so
// `await`ing it doesn't actually wait for the query to finish. Callers that
// need real await semantics (e.g. awaiting an INSERT before relying on the
// row existing) must use this instead.
function createNewPromiseConnection() {
    return mysqlPromise.createConnection(config);
}

function connectDatabase() {
    console.log("Database pool created");
}

module.exports = {
    getConnection,
    acquireConnection,
    createNewConnection,
    createNewPromiseConnection,
    connectDatabase,
};
