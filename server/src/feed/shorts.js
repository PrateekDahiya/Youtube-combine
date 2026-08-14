const { getConnection } = require("../db");
const { runQuery } = require("./helpers");

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const shortsShuffleCache = {
    ids: [],
    loadedAt: 0,
};
const SHORTS_CACHE_TTL = 10 * 60 * 1000;

const getShortsIdsInOrder = (callback) => {
    const connection = getConnection();

    if (
        shortsShuffleCache.ids.length > 0 &&
        Date.now() - shortsShuffleCache.loadedAt < SHORTS_CACHE_TTL
    ) {
        return callback(null, shortsShuffleCache.ids);
    }

    connection.query(
        `SELECT video_id FROM videos WHERE isShort = 1 AND upload_status = 0`,
        (error, results) => {
            if (error) {
                return callback(error);
            }
            const ids = shuffleArray(results.map((r) => r.video_id));
            shortsShuffleCache.ids = ids;
            shortsShuffleCache.loadedAt = Date.now();
            callback(null, ids);
        }
    );
};

async function shortsFeed(params) {
    const video_id = params.video_id;
    const needmore = Number(params.needmore || 0);

    if (video_id) {
        const query = `
            (SELECT v1.*, c1.* FROM videos v1 
            INNER JOIN channels c1 ON c1.channel_id = v1.channel_id 
            WHERE v1.video_id = ?)
            UNION ALL
            (SELECT v2.*, c2.* FROM videos v2 
            INNER JOIN channels c2 ON c2.channel_id = v2.channel_id 
            WHERE c2.channel_id = (
                SELECT v3.channel_id FROM videos v3 
                WHERE v3.video_id = ?
            ) AND v2.video_id != ? AND v2.upload_status = 0
            ORDER BY v2.upload_time
            LIMIT 5 OFFSET ?)
        `;
        const queryParams = [video_id, video_id, video_id, 5 * needmore];
        const results = await runQuery(query, queryParams);
        return { page: "shorts", shorts_vIds: results };
    }

    const ids = await new Promise((resolve, reject) => {
        getShortsIdsInOrder((error, result) => {
            if (error) {
                return reject(error);
            }
            resolve(result);
        });
    });

    const pageIds = ids.slice(5 * needmore, 5 * needmore + 5);
    if (pageIds.length === 0) {
        return { page: "shorts", shorts_vIds: [] };
    }

    const results = await runQuery(
        `SELECT v.*, c.* FROM videos v 
         INNER JOIN channels c ON c.channel_id = v.channel_id 
         WHERE v.video_id IN (?)`,
        [pageIds]
    );
    const orderMap = new Map(results.map((row) => [row.video_id, row]));
    const ordered = pageIds.map((id) => orderMap.get(id)).filter(Boolean);
    return { page: "shorts", shorts_vIds: ordered };
}

module.exports = shortsFeed;
