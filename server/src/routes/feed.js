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
} = require("../utils");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");

router.get("/api/home", syncHandler((req, res) => {
    const page_no = Number(req.query.page || 1);
    const query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 order by upload_time desc limit 24 offset ?`;
    const connection = getConnection();
    connection.query(query, [24 * (page_no - 1)], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ page: "home", videos: results });
    });
}));

router.get("/api/feed-by-tag", syncHandler((req, res) => {
    const tag = req.query.tag || "";
    const type = req.query.type || "";
    const page_no = Number(req.query.page || 1);
    const searchQuery = `%${tag}%`;

    const query = type
        ? `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) order by upload_time desc limit 24 offset ?`
        : `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) order by upload_time desc limit 24 offset ?`;

    const queryParams = type
        ? [categoryMap[type] || [type], 24 * (page_no - 1)]
        : [searchQuery, searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];

    const connection = getConnection();
    connection.query(
        query,
        queryParams,
        (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({ page: "home_tag", videos: results, tag, type });
        }
    );
}));

router.get("/api/home-tags", asyncHandler(async (req, res) => {
    const user_id = req.query.user_id;

    if (!user_id) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }

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

    res.status(200).json({ tags });
}));

router.get("/api/shorts", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const needmore = req.query.needmore || 0;

    let query;
    let queryParams;

    if (video_id) {
        query = `
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
        queryParams = [video_id, video_id, video_id, 5 * needmore];
    } else {
        query = `
            SELECT v.*, c.* FROM videos v 
            INNER JOIN channels c ON c.channel_id = v.channel_id 
            WHERE v.isShort = 1 AND v.upload_status = 0 
            ORDER BY RAND() DESC 
            LIMIT 5 OFFSET ?
        `;
        queryParams = [5 * needmore];
    }

    const connection = getConnection();
    connection.query(query, queryParams, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ page: "shorts", shorts_vIds: results });
    });
}));

router.get("/api/subscriptions", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const isShort = req.query.isShort;
    const page_no = Number(req.query.page || 1);
    const query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 order by v.upload_time desc limit 24 offset ?`;

    const connection = getConnection();
    connection.query(query, [user_id, isShort, 24 * (page_no - 1)], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ page: "subscription", data: results });
    });
}));

router.get("/api/category", syncHandler((req, res) => {
    const category = req.query.category;
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 order by v.upload_time desc limit 24 offset ?`;

    const connection = getConnection();
    connection.query(
        query,
        [categoryMappingFeed[category], type, 24 * (page_no - 1)],
        (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({
                page: "category",
                caticon: caticon[category],
                videos: results,
                category: category,
            });
        }
    );
}));

router.get("/api/trendings", syncHandler((req, res) => {
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
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(200).json({ page: "trendings", videos: results });
    });
}));

router.get("/api/search", syncHandler((req, res) => {
    const query = req.query.query;
    const searchQuery = `%${query}%`;
    const page_no = Number(req.query.page || 1);
    const videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (v.title like ? or v.tags like ? or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
    const channelQuery = `select * from channels where channel_name like ? or short_desc like ? or custom_url like ? or keywords like ? order by subscribers desc limit 20`;

    const connection = getConnection();
    connection.query(
        videoQuery,
        [searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)],
        (videoError, videoResults) => {
            if (videoError) {
                console.log(videoError);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            connection.query(
                channelQuery,
                [searchQuery, searchQuery, searchQuery, searchQuery],
                (channelError, channelResults) => {
                    if (channelError) {
                        console.log(channelError);
                        return res
                            .status(500)
                            .json({ error: "Internal Server Error" });
                    }

                    res.status(200).json({
                        page: "search",
                        videos: videoResults,
                        channels: channelResults,
                        query: query,
                    });
                }
            );
        }
    );
}));

module.exports = router;