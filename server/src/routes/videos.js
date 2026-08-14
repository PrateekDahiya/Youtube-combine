const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { createFeedAndGenerateSQL } = require("../utils");
const {
    fetchRelatedVideos,
    fetchVideoHistory,
} = require("../youtube");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, forbiddenResponse, sendResponse } = require("../utils/responseWrapper");
const { cacheFetch } = require("../utils/cache");

router.get("/watch", syncHandler((req, res) => {
    const videoId = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    const connection = getConnection();
    connection.query(query, [videoId], (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ page: "watch", data: results }, "Video details retrieved successfully"));
    });
}));

router.get("/related-videos", asyncHandler(async (req, res) => {
    const video_id = req.query.video_id;

    if (!video_id) {
        return sendResponse(res, validationErrorResponse("Missing video_id parameter"));
    }
    try {
        const data = await fetchRelatedVideos(video_id);
        sendResponse(res, successResponse(data, "Related videos retrieved successfully"));
    } catch (error) {
        if (error.statusCode) {
            return sendResponse(res, {
                success: false,
                data: null,
                message: error.message,
                statusCode: error.statusCode,
            });
        }
        sendResponse(res, errorResponse("Failed to fetch related videos"));
    }
}));

router.get("/personalized-feed", asyncHandler(async (req, res) => {
    const user_chl_id = req.query.user_id;
    const page_no = req.query.page || 1;

    if (!user_chl_id) {
        return sendResponse(res, validationErrorResponse("Missing user_id parameter"));
    }

    const cacheKey = `personalized-feed:${user_chl_id}:${page_no}`;

    cacheFetch(cacheKey, 60, async (done) => {
        try {
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
                    return done(error);
                }
                done(null, feed);
            });
        } catch (error) {
            done(error);
        }
    }, (error, feed) => {
        if (error) {
            return sendResponse(res, errorResponse("Database error"));
        }
        sendResponse(res, successResponse({
            page: "personalized_feed",
            videos: feed,
        }, "Personalized feed retrieved successfully"));
    });
}));

router.get("/getvideobyid", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("Getvideobyid: " + error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ video: results }, "Video retrieved successfully"));
    });
}));

router.get("/getvideosofchannel", syncHandler((req, res) => {
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
                return sendResponse(res, errorResponse("Database query failed"));
            }
            sendResponse(res, successResponse({ videos: results }, "Channel videos retrieved successfully"));
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
                    return sendResponse(res, errorResponse("Database query failed"));
                }

                sendResponse(res, successResponse({ videos: results }, "Channel videos retrieved successfully"));
            }
        );
    }
}));

router.get("/uploadStatus", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const query = `SELECT video_id, upload_status, upload_progress, link, upload_error FROM videos WHERE video_id = ?`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("UploadStatus: " + error);
            return sendResponse(res, errorResponse("Internal server error"));
        }
        sendResponse(res, successResponse({ upload: results[0] || null }, "Upload status retrieved successfully"));
    });
}));

router.get("/uploadingVideos", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `SELECT video_id, title, upload_status, upload_progress, upload_error, thumbnail_link, link, video_description, tags, category, isShort FROM videos WHERE channel_id = ? AND (upload_status != 0 OR link LIKE 'https://res.cloudinary.com/%' OR link LIKE '/uploads/%') ORDER BY upload_time DESC LIMIT 100`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log("UploadingVideos: " + error);
            return sendResponse(res, errorResponse("Internal server error"));
        }
        sendResponse(res, successResponse({ uploads: results }, "Uploading videos retrieved successfully"));
    });
}));

router.post("/updateVideo", syncHandler((req, res) => {
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
                return sendResponse(res, errorResponse("Failed to update video"));
            }
            if (results.affectedRows === 0) {
                return sendResponse(res, forbiddenResponse("Video not found or not authorized"));
            }
            sendResponse(res, successResponse(null, "Video updated successfully"));
        }
    );
}));

module.exports = router;