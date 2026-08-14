const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, sendResponse } = require("../utils/responseWrapper");

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