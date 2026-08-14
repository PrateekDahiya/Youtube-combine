const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, sendResponse } = require("../utils/responseWrapper");

router.get("/keep-active", syncHandler((req, res) => {
    sendResponse(res, successResponse({ active: true }, "Server is active"));
}));

router.get("/health", syncHandler((req, res) => {
    const connection = getConnection();
    connection.query("SELECT 1", (error) => {
        if (error) {
            return sendResponse(res, errorResponse("Database unreachable", 503, { db: "unreachable" }));
        }
        sendResponse(res, successResponse({ db: "connected" }, "Health check passed"));
    });
}));

module.exports = router;