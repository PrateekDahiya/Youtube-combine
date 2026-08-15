const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, notFoundResponse, sendResponse } = require("../utils/responseWrapper");

router.post("/addtosubs", syncHandler((req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;
    const query = `INSERT INTO subscriptions (user_id,channel_id) VALUES (?, ?)`;

    const connection = getConnection();
    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        sendResponse(res, successResponse(null, "Subscription added successfully"));
    });
}));

router.post("/removefromsubs", syncHandler((req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;

    if (!user_chl_id || !channel_id) {
        return sendResponse(res, validationErrorResponse("user_chl_id and channel_id are required"));
    }

    const query = `DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        if (results.affectedRows === 0) {
            return sendResponse(res, notFoundResponse("Subscription not found"));
        }

        sendResponse(res, successResponse(null, "Subscription removed successfully"));
    });
}));

router.get("/issub", syncHandler((req, res) => {
    const user_chl = req.query.user_id;
    const channel_id = req.query.channel_id;

    if (!user_chl || !channel_id) {
        return sendResponse(res, validationErrorResponse("user_id and channel_id are required"));
    }

    const query = `SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_chl, channel_id], (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query error"));
        }
        if (results.length > 0) {
            return sendResponse(res, successResponse({ sub: true }, "Subscription status retrieved"));
        } else {
            return sendResponse(res, successResponse({ sub: false }, "Subscription status retrieved"));
        }
    });
}));

router.get("/get-subs", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT * FROM subscriptions s join channels c where s.channel_id=c.channel_id and s.user_id= ? order by sub_time desc limit 500`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ subscription: results }, "Subscriptions retrieved successfully"));
    });
}));

module.exports = router;