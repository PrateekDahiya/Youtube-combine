const express = require("express");
const router = express.Router();
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, sendResponse } = require("../utils/responseWrapper");
const { getConnection } = require("../db");

const SUGGEST_LIMIT = 8;
const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 64;

router.get("/suggest", syncHandler((req, res) => {
    const q = (req.query.q || "").trim().slice(0, MAX_QUERY_LEN);
    if (q.length < MIN_QUERY_LEN) {
        return sendResponse(res, successResponse({ suggestions: [] }, "Query too short"));
    }

    const query = `SELECT s.term, s.kind, s.ref_id, v.isShort, v.thumbnail_link, c.channel_icon
                    FROM search_suggestions s
                    LEFT JOIN videos v ON s.kind = 'video' AND s.ref_id = v.video_id
                    LEFT JOIN channels c ON s.kind = 'channel' AND s.ref_id = c.channel_id
                    WHERE s.term LIKE ? ORDER BY s.popularity DESC LIMIT ?`;

    const connection = getConnection();
    connection.query(query, [q + "%", SUGGEST_LIMIT], (error, results) => {
        if (error) {
            console.log("Suggest: " + error);
            return sendResponse(res, successResponse({ suggestions: [] }, "Suggest unavailable"));
        }
        sendResponse(res, successResponse({ suggestions: results }, "Suggestions retrieved successfully"));
    });
}));

module.exports = router;
