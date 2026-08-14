const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { fetchVideoHistory } = require("../youtube");
const {
    categoryMap,
    categoryMappingFeed,
    caticon,
    trendingCategoryMapping,
    createFeedAndGenerateSQL,
    encodeCursor,
    decodeCursor,
} = require("../utils");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");
const { cacheFetch } = require("../utils/cache");
const {
    checkFullTextAvailability,
    isFullTextAvailable,
    buildFullTextQuery,
} = require("../utils/fulltext");

const HOME_TTL = 30;

router.get("/home", syncHandler((req, res) => {
    const cursor = decodeCursor(req.query.cursor);
    const page_no = Number(req.query.page || 1);
    const cacheKey = cursor ? `home:${cursor}` : `home:page:${page_no}`;
    let query;
    let queryParams;

    if (cursor) {
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [24 * (page_no - 1)];
    }

    const connection = getConnection();
    cacheFetch(cacheKey, HOME_TTL, (done) => {
        connection.query(query, queryParams, (error, results) => {
            if (error) {
                console.log(error);
                return done(error);
            }
            done(null, results);
        });
    }, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        const last = results[results.length - 1];
        const nextCursor =
            results.length === 24 && last
                ? encodeCursor(last.upload_time, last.video_id)
                : null;
        sendResponse(res, successResponse({ page: "home", videos: results, nextCursor }, "Home feed retrieved successfully"));
    });
}));

router.get("/feed-by-tag", syncHandler((req, res) => {
    const tag = req.query.tag || "";
    const type = req.query.type || "";
    const cursor = decodeCursor(req.query.cursor);
    const searchQuery = `%${tag}%`;

    const keysetClause =
        "and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?))";
    const orderClause = "order by v.upload_time desc, v.video_id desc limit 24";

    let query;
    let queryParams;
    let cacheKey;

    if (type) {
        cacheKey = `feed-by-tag:${type}:${cursor || "page:" + (req.query.page || 1)}`;
        if (cursor) {
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) ${keysetClause} ${orderClause}`;
            queryParams = [categoryMap[type] || [type], cursor.uploadTime, cursor.uploadTime, cursor.videoId];
        } else {
            const page_no = Number(req.query.page || 1);
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) ${orderClause} offset ?`;
            queryParams = [categoryMap[type] || [type], 24 * (page_no - 1)];
        }
    } else {
        cacheKey = `feed-by-tag:${tag}:${cursor || "page:" + (req.query.page || 1)}`;
        if (cursor) {
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) ${keysetClause} ${orderClause}`;
            queryParams = [searchQuery, searchQuery, searchQuery, searchQuery, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
        } else {
            const page_no = Number(req.query.page || 1);
            query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) ${orderClause} offset ?`;
            queryParams = [searchQuery, searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];
        }
    }

    const connection = getConnection();
    cacheFetch(cacheKey, HOME_TTL, (done) => {
        connection.query(
            query,
            queryParams,
            (error, results) => {
                if (error) {
                    console.log(error);
                    return done(error);
                }
                done(null, results);
            }
        );
    }, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        const last = results[results.length - 1];
        const nextCursor =
            results.length === 24 && last
                ? encodeCursor(last.upload_time, last.video_id)
                : null;
        sendResponse(res, successResponse({ page: "home_tag", videos: results, tag, type, nextCursor }, "Feed retrieved successfully"));
    });
}));

router.get("/home-tags", asyncHandler(async (req, res) => {
    const user_id = req.query.user_id;

    if (!user_id) {
        return sendResponse(res, validationErrorResponse("Missing user_id parameter"));
    }

    const cacheKey = `home-tags:${user_id}`;

    cacheFetch(cacheKey, 60, async (done) => {
        try {
            const videoHistory = await fetchVideoHistory(user_id);
            const counts = {};

            videoHistory.forEach((video) => {
                (video.tags || "")
                    .split(",")
                    .map((tag) => tag.toLowerCase().trim())
                    .filter(Boolean)
                    .forEach((tag) => {
                        counts[tag] = (counts[tag] || 0) + 1;
                    });
            });

            const tags = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tag]) => tag);

            done(null, { tags });
        } catch (error) {
            done(error);
        }
    }, (error, data) => {
        if (error) {
            console.log("Error fetching home tags:", error.message);
            return sendResponse(res, errorResponse("Failed to fetch home tags"));
        }
        sendResponse(res, successResponse(data, "Home tags retrieved successfully"));
    });
}));

const shortsShuffleCache = {
    ids: [],
    loadedAt: 0,
};
const SHORTS_CACHE_TTL = 10 * 60 * 1000;

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getShortsIdsInOrder(callback) {
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
}

router.get("/shorts", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const needmore = Number(req.query.needmore || 0);

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

        const connection = getConnection();
        connection.query(query, queryParams, (error, results) => {
            if (error) {
                console.error(error);
                return sendResponse(res, errorResponse("Internal server error"));
            }
            sendResponse(res, successResponse({ page: "shorts", shorts_vIds: results }, "Shorts retrieved successfully"));
        });
        return;
    }

    getShortsIdsInOrder((error, ids) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Internal server error"));
        }

        const pageIds = ids.slice(5 * needmore, 5 * needmore + 5);
        if (pageIds.length === 0) {
            return sendResponse(res, successResponse({ page: "shorts", shorts_vIds: [] }, "Shorts retrieved successfully"));
        }

        const connection = getConnection();
        connection.query(
            `SELECT v.*, c.* FROM videos v 
             INNER JOIN channels c ON c.channel_id = v.channel_id 
             WHERE v.video_id IN (?)`,
            [pageIds],
            (error, results) => {
                if (error) {
                    console.error(error);
                    return sendResponse(res, errorResponse("Internal server error"));
                }
                const orderMap = new Map(results.map((row) => [row.video_id, row]));
                const ordered = pageIds.map((id) => orderMap.get(id)).filter(Boolean);
                sendResponse(res, successResponse({ page: "shorts", shorts_vIds: ordered }, "Shorts retrieved successfully"));
            }
        );
    });
}));

router.get("/subscriptions", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const isShort = req.query.isShort;
    const cursor = decodeCursor(req.query.cursor);

    let query;
    let queryParams;

    if (cursor) {
        query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [user_id, isShort, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        const page_no = Number(req.query.page || 1);
        query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [user_id, isShort, 24 * (page_no - 1)];
    }

    const cacheKey = `subscriptions:${user_id}:${isShort}:${cursor || "page:" + (req.query.page || 1)}`;
    const connection = getConnection();
    cacheFetch(cacheKey, HOME_TTL, (done) => {
        connection.query(query, queryParams, (error, results) => {
            if (error) {
                console.log(error);
                return done(error);
            }
            done(null, results);
        });
    }, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        const last = results[results.length - 1];
        const nextCursor =
            results.length === 24 && last
                ? encodeCursor(last.upload_time, last.video_id)
                : null;
        sendResponse(res, successResponse({ page: "subscription", data: results, nextCursor }, "Subscriptions retrieved successfully"));
    });
}));

router.get("/category", syncHandler((req, res) => {
    const category = req.query.category;
    const type = req.query.type;
    const cursor = decodeCursor(req.query.cursor);

    let query;
    let queryParams;

    if (cursor) {
        query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?)) order by v.upload_time desc, v.video_id desc limit 24`;
        queryParams = [categoryMappingFeed[category], type, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        const page_no = Number(req.query.page || 1);
        query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 order by v.upload_time desc, v.video_id desc limit 24 offset ?`;
        queryParams = [categoryMappingFeed[category], type, 24 * (page_no - 1)];
    }

    const cacheKey = `category:${category}:${type}:${cursor || "page:" + (req.query.page || 1)}`;
    const connection = getConnection();
    cacheFetch(cacheKey, HOME_TTL, (done) => {
        connection.query(
            query,
            queryParams,
            (error, results) => {
                if (error) {
                    console.log(error);
                    return done(error);
                }
                done(null, results);
            }
        );
    }, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        const last = results[results.length - 1];
        const nextCursor =
            results.length === 24 && last
                ? encodeCursor(last.upload_time, last.video_id)
                : null;
        sendResponse(res, successResponse({
            page: "category",
            caticon: caticon[category],
            videos: results,
            category: category,
            nextCursor,
        }, "Category feed retrieved successfully"));
    });
}));

router.get("/trendings", syncHandler((req, res) => {
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);

    let query = `SELECT *, ((LOG(v.views + 1) * 0.3) + (v.likes * 0.3) + ((1 / (DATEDIFF(NOW(), v.upload_time) + 1)) * 0.4)) AS trending_score
                 FROM videos v
                 JOIN channels c ON v.channel_id = c.channel_id
                 WHERE v.upload_time >= NOW() - INTERVAL 10 DAY AND isShort = 0 AND v.upload_status = 0`;

    if (type != 0) {
        query += " AND v.category IN (?)";
    }

    query += " ORDER BY trending_score DESC LIMIT 24 OFFSET ?";

    const queryParams = type != 0 ? [trendingCategoryMapping[type], 24 * (page_no - 1)] : [24 * (page_no - 1)];

    const connection = getConnection();
    connection.query(query, queryParams, (error, results) => {
        if (error) {
            console.log(error);
            return sendResponse(res, errorResponse("Internal Server Error"));
        }
        sendResponse(res, successResponse({ page: "trendings", videos: results }, "Trending videos retrieved successfully"));
    });
}));

router.get("/search", syncHandler((req, res) => {
    const query = req.query.query;
    const searchQuery = `%${query}%`;
    const page_no = Number(req.query.page || 1);

    const runSearch = () => {
        let videoQuery;
        let videoParams;
        let channelQuery;
        let channelParams;

        if (isFullTextAvailable() && query && query.trim().length >= 3) {
            const ftQuery = buildFullTextQuery("title", query);
            videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (match(v.title, v.tags) against (? in boolean mode) or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
            videoParams = [ftQuery, searchQuery, 24 * (page_no - 1)];
            channelQuery = `select * from channels where match(channel_name, keywords, short_desc) against (? in boolean mode) order by subscribers desc limit 20`;
            channelParams = [ftQuery];
        } else {
            videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (v.title like ? or v.tags like ? or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
            videoParams = [searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];
            channelQuery = `select * from channels where channel_name like ? or short_desc like ? or custom_url like ? or keywords like ? order by subscribers desc limit 20`;
            channelParams = [searchQuery, searchQuery, searchQuery, searchQuery];
        }

        const connection = getConnection();
        connection.query(
            videoQuery,
            videoParams,
            (videoError, videoResults) => {
                if (videoError) {
                    console.log(videoError);
                    return sendResponse(res, errorResponse("Internal Server Error"));
                }

                connection.query(
                    channelQuery,
                    channelParams,
                    (channelError, channelResults) => {
                        if (channelError) {
                            console.log(channelError);
                            return sendResponse(res, errorResponse("Internal Server Error"));
                        }

                        sendResponse(res, successResponse({
                            page: "search",
                            videos: videoResults,
                            channels: channelResults,
                            query: query,
                        }, "Search results retrieved successfully"));
                    }
                );
            }
        );
    };

    checkFullTextAvailability(() => {
        runSearch();
    });
}));

module.exports = router;