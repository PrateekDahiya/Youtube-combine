const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, sendResponse } = require("../utils/responseWrapper");

router.post("/addtowatchlater", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `INSERT INTO watchlater (user_id, video_id,added_time) VALUES (?, ?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE added_time = CURRENT_TIMESTAMP`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        sendResponse(res, successResponse(null, "Added to watch later successfully"));
    });
}));

router.post("/removefromwatchlater", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `DELETE FROM watchlater WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        if (results.affectedRows === 0) {
            return sendResponse(res, notFoundResponse("Watch later entry not found"));
        }

        sendResponse(res, successResponse(null, "Removed from watch later successfully"));
    });
}));

module.exports = router;