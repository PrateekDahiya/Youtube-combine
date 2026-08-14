const { getConnection } = require("../db");

let fullTextAvailable = null;

function checkFullTextAvailability(callback) {
    if (fullTextAvailable !== null) {
        return callback(null, fullTextAvailable);
    }
    const connection = getConnection();
    connection.query(
        `SELECT COUNT(*) AS has_ft FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'videos'
           AND index_type = 'FULLTEXT'`,
        (error, results) => {
            if (error) {
                console.log("Fulltext availability check failed:", error.message);
                fullTextAvailable = false;
                return callback(null, false);
            }
            fullTextAvailable = !!(results && results[0] && results[0].has_ft > 0);
            callback(null, fullTextAvailable);
        }
    );
}

function isFullTextAvailable() {
    return fullTextAvailable;
}

function buildFullTextQuery(column, term) {
    const words = term
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .map((w) => `+${w}`)
        .join(" ");
    return words || term;
}

module.exports = {
    checkFullTextAvailability,
    isFullTextAvailable,
    buildFullTextQuery,
};
