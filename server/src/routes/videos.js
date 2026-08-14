const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, forbiddenResponse, sendResponse } = require("../utils/responseWrapper");
const { getVideosByType } = require("../feed");

router.post("/videos", asyncHandler(async (req, res) => {
    try {
        const payload = await getVideosByType(req.body.type, req.body);
        sendResponse(res, successResponse(payload, "Videos retrieved successfully"));
    } catch (error) {
        if (error.statusCode) {
            return sendResponse(res, {
                success: false,
                data: null,
                message: error.message,
                statusCode: error.statusCode,
            });
        }
        console.log(error);
        sendResponse(res, errorResponse("Failed to fetch videos"));
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