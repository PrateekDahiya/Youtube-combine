const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, sendResponse } = require("../utils/responseWrapper");

router.get("/history", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.*,h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ videos: results }, "History retrieved successfully"));
    });
}));

router.post("/addtohistory", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `INSERT INTO history (user_id, video_id, watched_time) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE watched_time = CURRENT_TIMESTAMP`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        sendResponse(res, successResponse(null, "Video added to history successfully"));
    });
}));

router.post("/removefromhistory", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `DELETE FROM history WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        if (results.affectedRows === 0) {
            return sendResponse(res, notFoundResponse("History not found"));
        }

        sendResponse(res, successResponse(null, "History removed successfully"));
    });
}));

module.exports = router;