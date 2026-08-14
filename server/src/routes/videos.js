const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const {
    createFeedAndGenerateSQL,
    fetchRelatedVideos,
    fetchVideoHistory,
} = require("../youtube");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");

router.get("/api/watch", syncHandler((req, res) => {
    const videoId = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    const connection = getConnection();
    connection.query(query, [videoId], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ page: "watch", data: results });
    });
}));

router.get("/api/related-videos", syncHandler((req, res) => {
    const video_id = req.query.video_id;

    if (!video_id) {
        res.status(400).json({ error: "Missing video_id parameter" });
        return;
    }
    fetchRelatedVideos(video_id, res);
}));

router.get("/api/personalized-feed", asyncHandler(async (req, res) => {
    const user_chl_id = req.query.user_id;
    const page_no = req.query.page || 1;

    if (!user_chl_id) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }

    const videoHistory = await fetchVideoHistory(user_chl_id);

    const excludedVideoIds = videoHistory.map((video) => video.video_id);

    const tags = videoHistory
        .map((video) => video.tags)
        .join(",")
        .split(",")
        .map((tag) => tag.trim());

    const sqlQuery = createFeedAndGenerateSQL(
        tags,
        excludedVideoIds,
        5,
        24,
        24 * (page_no - 1)
    );

    const connection = getConnection();
    connection.query(sqlQuery, (error, feed) => {
        if (error) {
            console.log("Error fetching related videos:", error.message);
            console.log("Generated SQL Query:", sqlQuery);
            res.status(500).json({ error: "Database error" });
            return;
        }

        res.status(200).json({
            page: "personalized_feed",
            videos: feed,
        });
    });
}));

router.get("/api/getvideobyid", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("Getvideobyid: " + error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ video: results });
    });
}));

router.get("/api/getvideosofchannel", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const searchTerm = req.query.query || "";
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);
    const formattedSearchTerm = `%${searchTerm}%`;

    let params;
    let query;
    if (searchTerm === "") {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        params = [channel_id, type, 24 * (page_no - 1)];

        const connection = getConnection();
        connection.query(query, params, (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({ videos: results });
        });
    } else {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 AND (v.title LIKE ?) 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        params = [channel_id, type, formattedSearchTerm, 24 * (page_no - 1)];

        const connection = getConnection();
        connection.query(
            query,
            params,
            (error, results) => {
                if (error) {
                    console.error(error);
                    return res
                        .status(500)
                        .json({ error: "Database query failed" });
                }

                res.status(200).json({ videos: results });
            }
        );
    }
}));

router.get("/api/uploadStatus", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const query = `SELECT video_id, upload_status, upload_progress, link, upload_error FROM videos WHERE video_id = ?`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("UploadStatus: " + error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ upload: results[0] || null });
    });
}));

router.get("/api/uploadingVideos", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `SELECT video_id, title, upload_status, upload_progress, upload_error, thumbnail_link, link, video_description, tags, category, isShort FROM videos WHERE channel_id = ? AND (upload_status != 0 OR link LIKE 'https://res.cloudinary.com/%' OR link LIKE '/uploads/%') ORDER BY upload_time DESC LIMIT 100`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log("UploadingVideos: " + error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ uploads: results });
    });
}));

router.post("/api/updateVideo", syncHandler((req, res) => {
    const video_id = req.body.video_id;
    const user_id = req.body.user_id;
    const title = (req.body.title || "").trim() || "Untitled";
    const description = req.body.description || "";
    const tags = req.body.tags || "";
    const category = req.body.category || "";
    const isShort = req.body.isShort == "short" ? 1 : req.body.isShort == "video" ? 0 : Number(req.body.isShort || 0);
    const thumbnail_link = req.body.thumbnail_link || "";

    const query = `UPDATE videos SET title = ?, video_description = ?, tags = ?, category = ?, isShort = ?, thumbnail_link = ? WHERE video_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(
        query,
        [title, description, tags, category, isShort, thumbnail_link, video_id, user_id],
        (error, results) => {
            if (error) {
                console.log("UpdateVideo: " + error);
                return res.status(500).json({ error: "Failed to update video" });
            }
            if (results.affectedRows === 0) {
                return res.status(403).json({ error: "Video not found or not authorized" });
            }
            res.status(200).json({ message: "Video updated" });
        }
    );
}));

module.exports = router;