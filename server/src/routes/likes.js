const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, sendResponse } = require("../utils/responseWrapper");

router.post("/addtoliked", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `INSERT INTO likedvideos (user_id, video_id) VALUES (?, ?)`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        sendResponse(res, successResponse(null, "Video liked successfully"));
    });
}));

router.post("/removefromliked", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `DELETE FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        if (results.affectedRows === 0) {
            return sendResponse(res, notFoundResponse("Like not found"));
        }

        sendResponse(res, successResponse(null, "Like removed successfully"));
    });
}));

router.get("/isliked", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return sendResponse(res, validationErrorResponse("user_id and video_id are required"));
    }

    const query = `SELECT * FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        if (results.length > 0) {
            return sendResponse(res, successResponse({ liked: true }, "Like status retrieved"));
        } else {
            return sendResponse(res, successResponse({ liked: false }, "Like status retrieved"));
        }
    });
}));

module.exports = router;