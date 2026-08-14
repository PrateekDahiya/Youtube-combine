const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

function cacheFetch(key, ttl, fetcher, callback) {
    const cached = cache.get(key);
    if (cached !== undefined) {
        return callback(null, cached);
    }
    fetcher((error, data) => {
        if (error) {
            return callback(error);
        }
        cache.set(key, data, ttl);
        callback(null, data);
    });
}

function cacheSet(key, data, ttl) {
    cache.set(key, data, ttl);
}

module.exports = {
    cache,
    cacheFetch,
    cacheSet,
};
