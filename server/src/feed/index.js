const fs = require("fs");
const path = require("path");
const { httpError } = require("./helpers");

const EXCLUDED_FILES = new Set(["helpers.js", "index.js"]);

const handlers = {};

for (const file of fs.readdirSync(__dirname)) {
    if (!file.endsWith(".js") || EXCLUDED_FILES.has(file)) {
        continue;
    }
    const type = path.basename(file, ".js");
    handlers[type] = require(path.join(__dirname, file));
}

const getVideosByType = (type, params = {}) => {
    const handler = handlers[type];
    if (!handler) {
        return Promise.reject(httpError(400, "Invalid type parameter"));
    }
    return handler(params);
};

module.exports = { getVideosByType, handlers };