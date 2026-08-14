const { getConnection } = require("../db");
const { cacheFetch } = require("../utils/cache");
const { attachWatchlaterFlag } = require("../utils/watchlaterFlag");
const { encodeCursor, decodeCursor } = require("../utils");

const HOME_TTL = 30;

const httpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const runQuery = (query, params) =>
    new Promise((resolve, reject) => {
        const connection = getConnection();
        connection.query(query, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });

const cachedQuery = (cacheKey, ttl, query, queryParams) =>
    new Promise((resolve, reject) => {
        cacheFetch(cacheKey, ttl, (done) => {
            const connection = getConnection();
            connection.query(query, queryParams, (error, results) => {
                if (error) {
                    return done(error);
                }
                done(null, results);
            });
        }, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });

const cachedFetch = (cacheKey, ttl, fetcher) =>
    new Promise((resolve, reject) => {
        cacheFetch(cacheKey, ttl, (done) => {
            Promise.resolve(fetcher()).then(
                (data) => done(null, data),
                (error) => done(error)
            );
        }, (error, data) => {
            if (error) {
                return reject(error);
            }
            resolve(data);
        });
    });

const flagVideos = (videos, userId) =>
    new Promise((resolve) => {
        if (!Array.isArray(videos) || videos.length === 0) {
            return resolve(videos || []);
        }
        const copy = videos.map((video) => ({ ...video }));
        attachWatchlaterFlag(getConnection(), copy, userId, (error, flagged) => {
            if (error) {
                return resolve(videos);
            }
            resolve(flagged);
        });
    });

const nextCursorFromVideos = (videos) => {
    const last = videos[videos.length - 1];
    return videos.length === 24 && last
        ? encodeCursor(last.upload_time, last.video_id)
        : null;
};

module.exports = {
    HOME_TTL,
    httpError,
    runQuery,
    cachedQuery,
    cachedFetch,
    flagVideos,
    nextCursorFromVideos,
    encodeCursor,
    decodeCursor,
};
