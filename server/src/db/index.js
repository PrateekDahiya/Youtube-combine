require("dns").setDefaultResultOrder("ipv4first");
const mysql = require("mysql2");

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

let connection;

function connectDatabase() {
    connection = mysql.createConnection(config);
    connection.connect((err) => {
        if (err) {
            console.error("Database Connection Failed! Error: ", err);
            return;
        }
        console.log("Database Connection Successful!");
    });
    connection.on("error", (err) => {
        console.error("MySQL connection error:", err.message);
        if (
            err.code === "PROTOCOL_CONNECTION_LOST" ||
            err.code === "ECONNRESET" ||
            err.code === "ETIMEDOUT" ||
            err.code === "ER_CON_COUNT_ERROR"
        ) {
            console.log("Reconnecting to MySQL in 3 seconds...");
            setTimeout(connectDatabase, 3000);
        } else {
            console.error("Unhandled MySQL error:", err);
        }
    });
}

function getConnection() {
    return connection;
}

function createNewConnection() {
    return mysql.createConnection(config);
}

connectDatabase();

module.exports = {
    getConnection,
    createNewConnection,
    connectDatabase,
};